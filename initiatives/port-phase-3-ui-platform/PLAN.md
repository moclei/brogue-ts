# Phase 3: UI & Platform — Plan

## Approach

Phase 3 ports ~8,700 lines of C across 5 files, plus defines the platform abstraction and implements a browser renderer. The work is organized into 4 steps that build on each other:

```
Step 1: IO Core        → Color manipulation, display buffers, cell rendering, text/string display
Step 2: IO Game UI     → Messages, sidebar, inventory, targeting, input dispatch, visual effects
Step 3: Menus & Wizard → Buttons, main menu, title flames, wizard debug dialogs
Step 4: Game Loop      → initializeRogue, startLevel, gameOver, victory, freeEverything
Step 5: Platform       → BrogueConsole interface, Canvas2D browser renderer, input handling
Step 6: Wire-up        → Deferred stubs, integration, playable browser build
```

Each step produces independently testable modules. Steps 1–4 are pure logic (no platform dependencies). Step 5 introduces the platform layer. Step 6 wires everything together.

---

## Step 1: IO Core — `ts/src/io/`

Port the foundational rendering primitives from IO.c. These are the building blocks used by all other UI code.

### Sub-modules

**`io-color.ts`** — Color manipulation functions (~200 lines)
- `applyColorMultiplier`, `applyColorAverage`, `applyColorAugment`, `applyColorScalar`
- `applyColorBounds`, `desaturate`, `randomizeColor`, `swapColors`
- `bakeColor`, `normColor`, `separateColors`
- `storeColorComponents`, `colorFromComponents`
- `shuffleTerrainColors`, `colorMultiplierFromDungeonLight`
- `encodeMessageColor`, `decodeMessageColor`
- DI via `ColorContext` (needs RNG for randomizeColor, terrain grid for colorMultiplier)

**`io-display.ts`** — Display buffer and cell rendering (~300 lines)
- `screenDisplayBuffer` type (100×34 grid of cells with glyph + fg/bg colors)
- `SavedDisplayBuffer` type
- `clearDisplayBuffer`, `copyDisplayBuffer`, `saveDisplayBuffer`, `restoreDisplayBuffer`
- `overlayDisplayBuffer`
- `plotCharWithColor` (the core rendering call — writes to platform via console.plotChar)
- `plotCharToBuffer` (writes to an off-screen buffer instead)
- `plotForegroundChar`
- `commitDraws`, `refreshScreen`, `displayLevel`, `refreshDungeonCell`
- `dumpLevelToScreen`
- DI via `DisplayContext` (needs platform console for plotChar, game state for map/lighting)

**`io-appearance.ts`** — Cell appearance calculation (~400 lines)
- `getCellAppearance` — the big function that computes what glyph + colors to show for a dungeon cell, considering terrain layers, items, monsters, lighting, remembered state, discovery, etc.
- `hiliteCell`, `colorBlendCell`, `highlightScreenCell`
- `hiliteCharGrid`
- `blackOutScreen`, `colorOverDungeon`
- DI via `AppearanceContext` (needs pmap, tmap, lighting, items, monsters, player state)

**`io-text.ts`** — Text rendering and wrapping (~150 lines)
- `printString`, `printStringWithWrapping`, `wrapText`
- `breakUpLongWordsIn`
- `printTextBox`, `rectangularShading`
- `upperCase`, `strLenWithoutEscapes` (already partially ported in combat-helpers)
- DI: minimal — needs display buffer and console

### Key Design Decision: Display Buffer

The C code renders through `plotCharWithColor` which calls `currentConsole.plotChar`. In TypeScript, we'll:
1. Maintain a `screenDisplayBuffer` (100×34 array) as the primary rendering target
2. `plotCharToBuffer` writes to a buffer, `plotCharWithColor` writes to the "live" display buffer
3. `commitDraws` flushes the live buffer to the platform console
4. This enables testing by inspecting buffer state without a real renderer

---

## Step 2: IO Game UI — `ts/src/io/`

Port the interactive UI elements from IO.c. These build on Step 1's rendering primitives.

### Sub-modules

**`io-messages.ts`** — Message system (~300 lines)
- `message`, `messageWithColor`, `flavorMessage`, `temporaryMessage`
- `displayRecentMessages`, `formatRecentMessages`, `displayMessageArchive`
- `displayMoreSign`, `displayMoreSignWithoutWaitingForAcknowledgment`
- `confirmMessages`, `deleteMessages`, `updateMessageDisplay`, `clearMessageArchive`
- `archivedMessage` type, message archive ring buffer
- DI via `MessageContext` (needs display, game state for turn numbers)

**`io-sidebar.ts`** — Sidebar rendering (~250 lines)
- `refreshSideBar` — the large function that lists visible monsters, items, terrain in the sidebar
- `printMonsterInfo`, `printItemInfo`, `printTerrainInfo`
- `printMonsterDetails`, `printFloorItemDetails`, `printCarriedItemDetails`
- Entity display type enum (`EDT_CREATURE`, `EDT_ITEM`, `EDT_TERRAIN`)
- DI via `SidebarContext` (needs monsters, items, pmap, visibility, display)

**`io-inventory.ts`** — Inventory display (~300 lines from Items.c `displayInventory`)
- `displayInventory` (the big inventory screen with button-based selection)
- Item detail formatting helpers
- `describeHallucinatedItem`
- DI via `InventoryContext`

**`io-targeting.ts`** — Cursor and targeting (~200 lines)
- `showCursor`, `hideCursor`, `clearCursorPath`
- `getPlayerPathOnMap`, `reversePath`, `hilitePath`
- `getClosestValidLocationOnMap`, `processSnapMap`
- DI via `TargetingContext`

**`io-input.ts`** — Input dispatch and main loop (~500 lines)
- `mainInputLoop` — the core in-game input handler (~300 lines)
- `nextBrogueEvent` — event dispatch with playback support
- `executeKeystroke`, `executeMouseClick`
- `actionMenu` — in-game command menu
- `pauseBrogue`, `pauseAnimation`
- `waitForAcknowledgment`, `waitForKeystrokeOrMouseClick`, `confirm`
- `getInputTextString` — text entry dialog
- `stripShiftFromMovementKeystroke`
- `displayMonsterFlashes`
- DI via `InputContext` (needs platform console, recording system, game state)

**`io-effects.ts`** — Visual effects (~300 lines)
- `flashForeground`, `flashCell`, `colorFlash`
- `funkyFade`, `irisFadeBetweenBuffers`
- `printProgressBar`
- `flashMessage`, `flashTemporaryAlert`, `displayCenteredAlert`
- DI via `EffectsContext` (needs display, pause/timing)

**`io-screens.ts`** — Info screens (~300 lines)
- `printHelpScreen`, `printHighScores`, `displayFeatsScreen`, `printDiscoveriesScreen`
- `printSeed`, `displayGrid`
- DI via `ScreenContext`

---

## Step 3: Menus & Wizard — `ts/src/menus/`

### Sub-modules

**`buttons.ts`** — Button widget system (Buttons.c, 368 lines)
- `brogueButton` type, `buttonDrawStates` enum
- `initializeButton`, `setButtonText`
- `drawButton`, `drawButtonsInState`
- `initializeButtonState`, `processButtonInput`, `buttonInputLoop`
- `smoothHiliteGradient`
- DI via `ButtonContext` (needs display, input events)

**`main-menu.ts`** — Title screen and menu navigation (MainMenu.c, ~1,200 lines)
- Menu flame simulation: `initializeMenuFlames`, `updateMenuFlames`, `drawMenuFlames`
- `mainBrogueJunction` — top-level menu entry point
- `initializeMainMenuButtons`, `stackButtons`
- `titleMenu` — the animated title screen with button selection
- `dialogChooseFile`, `dialogAlert`
- File listing and selection UI
- DI via `MenuContext` (needs display, buttons, input, file I/O)

**`wizard.ts`** — Debug/wizard mode (Wizard.c, 522 lines)
- `dialogCreateItemOrMonster` — the main wizard dialog
- `dialogSelectEntryFromList` — generic list selection dialog
- `dialogCreateItemChooseVorpalEnemy`, `dialogCreateItemChooseRunic`, etc.
- DI via `WizardContext` (needs buttons, display, item/monster catalogs)

---

## Step 4: Game Loop — `ts/src/game/`

Port RogueMain.c — the orchestration layer that ties everything together.

### Sub-modules

**`game-init.ts`** — Game initialization (~350 lines)
- `initializeRogue` — the big initialization function (seed setup, player creation, starting inventory, level seed generation, map initialization)
- `initializeGameVariant` — variant selection
- `welcome` — opening messages
- DI via `GameInitContext` (needs RNG, item generation, monster catalogs, recording init)

**`game-level.ts`** — Level transitions (~400 lines)
- `startLevel` — the complex level transition function (save current level, generate or restore new level, place player, simulate environment, update vision)
- `updateColors` — depth-dependent dynamic colors
- DI via `LevelContext` (needs architect, environment, vision, dijkstra, item/monster systems)

**`game-lifecycle.ts`** — Game end states (~400 lines)
- `gameOver` — death handling (death message, inventory display, high score, save recording)
- `victory` — victory handling (congratulations screens, treasure tally, achievements)
- `enableEasyMode` — easy mode toggle
- DI via `LifecycleContext` (needs display, messages, inventory, high scores, recording)

**`game-cleanup.ts`** — Resource cleanup (~100 lines)
- `freeEverything` — clean up all game state
- `freeCreature` — clean up a creature
- `removeDeadMonsters` — purge dead monsters from lists
- DI via `CleanupContext`

**`game-events.ts`** — Event dispatch (~50 lines)
- `executeEvent` — dispatch rogueEvent to keystroke/mouse handlers
- `fileExists`, `chooseFile`, `openFile` — file operations
- `unflag` — utility
- DI via `EventContext`

---

## Step 5: Platform — `ts/src/platform/`

### Sub-modules

**`platform-interface.ts`** — TypeScript equivalent of `brogueConsole`
```typescript
interface BrogueConsole {
  gameLoop(): void;
  pauseForMilliseconds(ms: number, behavior: PauseBehavior): boolean;
  nextKeyOrMouseEvent(textInput: boolean, colorsDance: boolean): RogueEvent;
  plotChar(glyph: DisplayGlyph, x: number, y: number,
           foreRed: number, foreGreen: number, foreBlue: number,
           backRed: number, backGreen: number, backBlue: number): void;
  remap(from: string, to: string): void;
  modifierHeld(modifier: number): boolean;
  notifyEvent(eventId: number, data1: number, data2: number, str1: string, str2: string): void;
  takeScreenshot?(): boolean;
  setGraphicsMode?(mode: GraphicsMode): GraphicsMode;
}
```

**`glyph-map.ts`** — DisplayGlyph → Unicode mapping (from platformdependent.c)
- `glyphToUnicode`, `isEnvironmentGlyph`

**`browser-renderer.ts`** — Canvas2D browser implementation
- Canvas2D-based renderer for the 100×34 character grid
- Font measurement and cell sizing
- Keyboard event → RogueEvent translation
- Mouse event → RogueEvent translation (with grid coordinate mapping)
- `pauseForMilliseconds` via `requestAnimationFrame` / `setTimeout`
- Tile rendering support (optional, future)

**`null-platform.ts`** — Headless platform for testing
- No-op implementations for all console methods
- Useful for unit tests and seed catalog generation

---

## Step 6: Wire-up & Deferred Items

### Deferred Phase 2 stubs to fulfill:
- **Interactive item handlers** (`ts/src/items/item-usage.ts`): scroll/potion/wand handlers that need UI prompts (targeting, inventory selection)
- **Playback UI** (`ts/src/recordings/`): `executePlaybackInput`, `seek`, `pausePlayback`
- **Interactive save/load** (`ts/src/recordings/recording-save-load.ts`): `saveGame`, `saveRecording` (with text input dialog), `loadSavedGame`
- **Annotation system** (`ts/src/recordings/`): `displayAnnotation`, `loadNextAnnotation`, `parseFile`
- **Architect stubs** (`ts/src/architect/architect.ts`): `restoreMonster`, `restoreItems`, `initializeLevel` (full implementations)
- **`mainInputLoop` integration** — wiring all the keystrokes to their handlers

### Integration:
- Wire `BrogueConsole` into all DI contexts
- Create the top-level game entry point that ties init → menu → game loop → cleanup
- Browser entry point (`index.html` + bootstrap script)

---

## Technical Notes

### Display Buffer Architecture

The C code has two rendering paths:
1. **Direct rendering**: `plotCharWithColor` → `currentConsole.plotChar` (immediately draws)
2. **Buffered rendering**: `plotCharToBuffer` → `screenDisplayBuffer` → `overlayDisplayBuffer` → `commitDraws`

In TypeScript, we unify around a double-buffer approach:
- **Back buffer**: `screenDisplayBuffer` (100×34 cells)
- **Front buffer / platform**: `BrogueConsole.plotChar` only called during `commitDraws`
- This enables efficient diffing (only update changed cells) and testing

### Color System

Brogue uses a 0–100 RGB scale (not 0–255). Colors have random components that are baked at render time. Key types:
- `color { red, green, blue, redRand, greenRand, blueRand, rand, colorDances }`
- `bakeColor` resolves random components using cosmetic RNG
- Color escapes in strings: `COLOR_ESCAPE` byte followed by 3 bytes (R, G, B)

### Async Considerations

The C code is synchronous — `pauseForMilliseconds` blocks, `nextKeyOrMouseEvent` blocks. In TypeScript/browser:
- Use `async/await` with `setTimeout`-based delays
- The game loop will be async
- `nextKeyOrMouseEvent` will return a `Promise<RogueEvent>`
- This means many functions up the call chain will need to be `async`
- Key decision: make IO functions async from the start, even if the game logic layer stays synchronous

### Testing Strategy

- **IO Core**: Test color math with known inputs/outputs. Test buffer operations.
- **Game UI**: Test message archive logic, sidebar entity listing, cell appearance calculation.
- **Buttons**: Test button state machine, input processing, gradient calculation.
- **Game Loop**: Test `initializeRogue` with known seeds — verify player starts with correct equipment, levels seeded correctly. Test `startLevel` state transitions.
- **Platform**: Test glyph mapping. Browser renderer tested manually + with snapshot tests.

---

## Open Questions

- **Async boundary**: Where exactly should `async` begin? Just the platform layer, or does it permeate into the IO functions? The C code's synchronous `pauseBrogue`/`nextKeyOrMouseEvent` are called from deep within game logic. We may need to restructure the call graph or use a continuation-passing style.
- **Font choice**: What monospace font for the Canvas2D renderer? System font, bundled font, or user-selectable?
- **Tile support**: Should the Canvas2D renderer support graphical tiles from the start, or text-only first?
- **Display buffer diffing**: Implement dirty-cell tracking for efficient redraws, or just redraw everything each frame?
