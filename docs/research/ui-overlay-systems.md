# UI Overlay Systems

> Last verified: 2026-03-24 | Commit: HEAD

## Summary

The TypeScript port renders the game on a 100×34 character grid partitioned into a 20-column sidebar, a 79×29 dungeon viewport, and a 3-row message area. All UI — sidebar, messages, inventory, targeting, text boxes, menus — is built from `ScreenDisplayBuffer` overlays that are composed via alpha blending (`overlayDisplayBuffer`), then flushed to a browser `<canvas>` by `commitDraws()`. The system faithfully mirrors C's `IO.c` / `Buttons.c` architecture with dependency-injected contexts replacing global state.

## Key Files

| File (C) | File (TS) | Responsibility |
|----------|-----------|----------------|
| Rogue.h (macros) | `types/constants.ts` | Grid dimensions: COLS, ROWS, DCOLS, DROWS, STAT_BAR_WIDTH, MESSAGE_LINES |
| IO.c (display buffer ops) | `io/display.ts` | `ScreenDisplayBuffer` CRUD, coordinate conversion, overlay, `plotCharWithColor` |
| IO.c (text) | `io/text.ts` | `printString`, `printStringWithWrapping`, `wrapText`, `splitLines`, color escapes |
| IO.c (messages) | `io/messages.ts` + `io/messages-state.ts` | Message archive, display, `--MORE--`, combat text buffering |
| IO.c (sidebar) | `io/sidebar-player.ts` + `io/sidebar-monsters.ts` | Progress bars, entity rendering, `refreshSideBar`, `collectSidebarEntities` |
| IO.c (sidebar wiring) | `io/sidebar-wiring.ts` | `buildSidebarContext()`, `buildRefreshSideBarWithFocusFn()` |
| Buttons.c | `io/buttons.ts` | `BrogueButton` init/draw/input loop, `ButtonState`, highlight gradients |
| Items.c (inventory) | `io/inventory.ts` + `io/inventory-display.ts` | `printTextBox`, `rectangularShading`, `displayInventory`, `promptForItemOfType` |
| Items.c (targeting) | `items/targeting.ts` | `hiliteTrajectory`, `chooseTarget`, `playerCancelsBlinking` |
| IO.c (cursor/targeting) | `io/targeting.ts` | `hilitePath`, `clearCursorPath`, `hiliteCell`, snap map, path-on-map |
| IO.c (cursor input) | `io/cursor-move.ts` | `moveCursor`, `autoTarget`, `nextTargetAfter` |
| IO.c (effects) | `io/effects.ts` + `io/effects-alerts.ts` | `flashCell`, `colorFlash`, `funkyFade`, `irisFadeBetweenBuffers`, `flashTemporaryAlert` |
| Light.c (flares) | `light/flares.ts` | `newFlare`, `animateFlares`, `drawFlareFrame` — expanding/fading light FX |
| IO.c (overlay screens) | `io/overlay-screens.ts` | `printHelpScreen`, `displayFeatsScreen`, `printDiscoveriesScreen` |
| IO.c (hover) | `io/hover-wiring.ts` | Mouse hover → sidebar update + path highlight |
| IO.c (menu bar) | `io/menu-bar.ts` | Bottom-bar action buttons (Explore/Rest/Search/Menu/Inventory) |
| IO.c (action menu) | `io/input-mouse.ts` | `actionMenu` popup, `executeMouseClick` |
| IO.c (input dispatch) | `io/input-dispatch.ts` + `io/input-keystrokes.ts` | `executeKeystroke`, `executeEvent`, `getInputTextString` |
| IO.c (input context) | `io/input-context.ts` | `buildInputContext()` — DI context wiring all IO dependencies |
| IO.c (cell appearance) | `io/cell-appearance.ts` | `getCellAppearance` — computes glyph + colors for each map cell |
| IO.c (color) | `io/color.ts` | Color math: `applyColorAverage/Augment/Scalar/Bounds`, encode/decode message colors |
| IO.c (render state) | `render-state.ts` | `terrainRandomValues`, `displayDetail`, `shuffleTerrainColors` |
| MainMenu.c | `menus/main-menu.ts` | Title screen, menu navigation, game dispatch |
| MainMenu.c (flames) | `menus/menu-flames.ts` | Title screen flame animation |
| MainMenu.c (buttons) | `menus/menu-buttons.ts` | Menu button layout helpers |
| MainMenu.c (menus ctx) | `menus.ts` + `menus/menu-types.ts` | `buildMenuContext()`, `MenuContext` interface |
| — | `platform.ts` | Event loop, `commitDraws()`, `waitForEvent()`, `pauseAndCheckForEvent()` |
| — | `platform/browser-renderer.ts` | Canvas2D console: plotChar dispatch, keyboard/mouse event translation |
| — | `platform/renderer.ts` | `Renderer` interface (drawCell contract) |
| — | `platform/text-renderer.ts` | `TextRenderer` — Unicode glyphs on colored background |
| — | `platform/sprite-renderer.ts` | `SpriteRenderer` — tile-based rendering with layer compositing |

## Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `plotCharWithColor` | `io/display.ts` | Bake random color components, write glyph+colors into display buffer cell |
| `plotCharToBuffer` | `io/display.ts` | Write glyph+colors into an arbitrary ScreenDisplayBuffer |
| `overlayDisplayBuffer` | `io/display.ts` | Alpha-blend one buffer onto another (pure, returns results) |
| `applyOverlay` | `io/display.ts` | Side-effecting overlay (writes blended results back into target buffer) |
| `saveDisplayBuffer` / `restoreDisplayBuffer` | `io/display.ts` | Deep-copy save/restore for overlay stacking |
| `commitDraws` | `platform.ts` | Dirty-cell flush from displayBuffer to canvas via plotChar |
| `refreshSideBar` | `io/sidebar-monsters.ts` | Collect visible entities, render sidebar column |
| `printProgressBar` | `io/sidebar-player.ts` | 20-column progress bar with centered label |
| `message` | `io/messages.ts` | Insert/collapse message, redraw display, optional acknowledgment |
| `displayMessageArchive` | `io/messages.ts` | Pull-down animated message history viewer |
| `updateMessageDisplay` | `io/messages.ts` | Render current messages to screen rows 0–2 |
| `buttonInputLoop` | `io/buttons.ts` | Overlay buttons, await input, return chosen button index |
| `drawButton` | `io/buttons.ts` | Render single button with gradient, hover, pressed states |
| `displayInventory` | `io/inventory-display.ts` | Full inventory screen with item buttons and detail panels |
| `printTextBox` | `io/inventory.ts` | Positioned text panel with shading and optional buttons |
| `rectangularShading` | `io/inventory.ts` | Distance-based opacity falloff for overlay backgrounds |
| `chooseTarget` | `items/targeting.ts` | Targeting cursor loop for wands/staves/throwing |
| `hiliteTrajectory` | `items/targeting.ts` | Highlight/erase bolt path on dungeon map |
| `hiliteCell` | `io/targeting.ts` | Color-tint a single dungeon cell |
| `hilitePath` / `clearCursorPath` | `io/targeting.ts` | Set/clear IS_IN_PATH flags for path visualization |
| `printHelpScreen` | `io/overlay-screens.ts` | Keybinding reference overlay |
| `displayFeatsScreen` | `io/overlay-screens.ts` | Feats/achievements overlay |
| `printDiscoveriesScreen` | `io/overlay-screens.ts` | Item discoveries overlay |
| `flashCell` / `colorFlash` | `io/effects.ts` | Single-cell and expanding radial flash effects |
| `funkyFade` | `io/effects.ts` | Psychedelic wave-pattern fade for death/victory |
| `irisFadeBetweenBuffers` | `io/effects.ts` | Radial iris transition between two buffers |
| `flashTemporaryAlert` | `io/effects-alerts.ts` | Centered teal alert with animated fade |
| `displayMonsterFlashes` | `io/effects-alerts.ts` | Process MB_WILL_FLASH on all creatures |
| `animateFlares` | `light/flares.ts` | Multi-frame expanding/fading light effect loop |
| `actionMenu` | `io/input-mouse.ts` | In-game settings/action popup menu |
| `buildInputContext` | `io/input-context.ts` | Master DI context wiring for all IO |
| `getCellAppearance` | `io/cell-appearance.ts` | Compute glyph + colors for a map cell |
| `printString` / `printStringWithWrapping` | `io/text.ts` | Render text into buffer with color escape handling |
| `wrapText` | `io/text.ts` | Word-wrap with color escape awareness |

## Data Structures

### ScreenDisplayBuffer

The central rendering primitive. A 100×34 grid of `CellDisplayBuffer` cells:

```typescript
interface CellDisplayBuffer {
    character: DisplayGlyph;       // Unicode code point (space = 32)
    foreColorComponents: number[]; // [R, G, B] in 0–100 scale
    backColorComponents: number[]; // [R, G, B] in 0–100 scale
    opacity: number;               // 0–100, used during overlay blending
    tileType?: TileType;           // sprite lookup hint for tile renderer
    underlyingTerrain?: TileType;  // terrain under creatures
}
```

Every overlay panel (inventory, text box, message archive, menu) creates a fresh
`ScreenDisplayBuffer`, draws into it with `plotCharToBuffer` / `printString`, sets
per-cell `opacity`, then calls `overlayDisplayBuffer()` to alpha-blend it onto the
main display buffer.

### SavedDisplayBuffer

Deep copy of a `ScreenDisplayBuffer` for save/restore patterns:

```typescript
interface SavedDisplayBuffer {
    savedScreen: ScreenDisplayBuffer;
}
```

### MessageState

Ring buffer of archived messages plus display state:

```typescript
interface MessageState {
    archive: ArchivedMessage[];     // ring buffer, length MESSAGE_ARCHIVE_ENTRIES
    archivePosition: number;        // write cursor
    displayedMessage: string[];     // MESSAGE_LINES current display rows
    messagesUnconfirmed: number;    // lines from current turn (bright)
    combatText: string;             // buffered combat messages
}
```

### BrogueButton / ButtonState

Widget system for clickable text buttons:

```typescript
interface BrogueButton {
    text: string;                  // may contain color escape sequences
    x: number; y: number;         // window position
    hotkey: number[];              // keyboard shortcuts
    buttonColor: Color;            // background color (gradient applied)
    opacity: number;               // 0–100
    symbol: DisplayGlyph[];        // glyph substitutions for '*' chars
    flags: number;                 // B_ENABLED | B_GRADIENT | B_HOVER_ENABLED | ...
}

interface ButtonState {
    buttonChosen: number;          // index of selected button (-1 = none)
    buttonFocused: number;         // currently hovered
    buttonDepressed: number;       // currently pressed (mouse-down)
    buttonCount: number;
    buttons: BrogueButton[];
    winX, winY, winWidth, winHeight: number;  // click boundary
}
```

## Flow

### 1. Grid Partitioning

Defined in `types/constants.ts`:

```
COLS = 100, ROWS = 34 (31 + MESSAGE_LINES)
MESSAGE_LINES = 3
STAT_BAR_WIDTH = 20
DCOLS = 79 (COLS - STAT_BAR_WIDTH - 1)
DROWS = 29 (ROWS - MESSAGE_LINES - 2)
```

Layout (window coordinates):

```
Columns 0–19:   Sidebar (STAT_BAR_WIDTH = 20)
Column 20:      Separator
Columns 21–99:  Dungeon viewport (DCOLS = 79)
Rows 0–2:       Message area (MESSAGE_LINES = 3)
Rows 3–31:      Dungeon viewport (DROWS = 29)
Row 32:         Flavor text line (ROWS - 2)
Row 33:         Menu bar / depth display (ROWS - 1)
```

Coordinate conversion (`io/display.ts`):
- `mapToWindow(pos)` → `{ windowX: pos.x + STAT_BAR_WIDTH + 1, windowY: pos.y + MESSAGE_LINES }`
- `windowToMap(wpos)` → reverse

### 2. Display Buffer Lifecycle

1. **Game state → display buffer:** `displayLevel()` / `refreshDungeonCell()` calls
   `getCellAppearance()` for each cell, bakes random terrain colors, writes
   glyph+colors into `displayBuffer` via `plotCharWithColor()`.
2. **Sidebar rendering:** `refreshSideBar()` writes progress bars and entity info
   directly into `displayBuffer` columns 0–19.
3. **Message rendering:** `updateMessageDisplay()` writes message strings into
   `displayBuffer` rows 0–2.
4. **Overlay panels** (inventory, text box, help screen, etc.):
   - `saveDisplayBuffer()` — snapshot current state
   - Create fresh `ScreenDisplayBuffer`, draw content, set opacity
   - `overlayDisplayBuffer()` — alpha-blend overlay onto display buffer
   - Wait for input
   - `restoreDisplayBuffer()` — revert to snapshot
5. **Flush to canvas:** `commitDraws()` walks all 100×34 cells, compares against
   `_prevBuffer`, calls `plotChar()` for dirty cells.

### 3. Sidebar Rendering

Entry point: `refreshSideBar(focusX, focusY, focusedEntityMustGoFirst, ctx)` in
`io/sidebar-monsters.ts`.

**Entity collection** (`collectSidebarEntities`):
1. Player always first
2. Item at player location
3. Focused entity (if specified)
4. Two passes (direct vision, then indirect): monsters by proximity, items by
   proximity, terrain by concentric scan

**Per-entity rendering:**
- `printMonsterInfo()` — glyph + name + mutation + health bar + status effects + stats
- `printItemInfo()` — glyph + name + wrapping
- `printTerrainInfo()` — glyph + description

**Progress bars** (`printProgressBar`): 20-column bars with centered labels,
alternating row shading, fill proportional to amount/max.

**Highlight gradient:** When an entity is focused, `smoothHiliteGradient()`
(sinusoidal curve) applies a subtle white highlight across the sidebar width.

**Depth footer:** `-- Depth: N --` at ROWS-1.

### 4. Message System

**Architecture:**
- `MessageState` holds a ring buffer of `ArchivedMessage` entries
  (MESSAGE_ARCHIVE_ENTRIES = 200).
- `addMessageToArchive()` — inserts or collapses (bumps repeat count) messages.
- `foldMessages()` — combines FOLDABLE messages from the same turn with semicolons.
- `formatRecentMessages()` — fills a buffer with wrapped, capitalized, folded messages.
- `displayRecentMessages()` → `updateMessageDisplay()` — renders into display
  buffer rows 0–2.
- Unconfirmed messages are bright; confirmed messages dim progressively.

**Special message types:**
- `message()` — standard, optionally requires acknowledgment (`--MORE--`)
- `messageWithColor()` — prepends a color escape
- `flavorMessage()` — prints to ROWS-2 (never archived)
- `temporaryMessage()` — clears message area, prints ephemeral prompt
- `combatMessage()` / `displayCombatText()` — buffered combat text (player
  messages before monster messages)

**Message archive UI** (`displayMessageArchive`):
- Pull-down animation: `animateMessageArchive(opening=true)` with frame delay
- Scroll navigation: up/down keys or page-jump
- Pull-up animation on dismiss
- Uses `overlayDisplayBuffer` with per-row `INTERFACE_OPACITY` and fade gradient

### 5. Button / Menu Widget System

**Initialization:** `initializeButton()` creates a button with default flags
(B_ENABLED | B_GRADIENT | B_HOVER_ENABLED | B_DRAW | B_KEYPRESS_HIGHLIGHT) and
colors (interfaceButtonColor bg, white text).

**Drawing** (`drawButton`):
- Applies highlight gradient via `smoothHiliteGradient()` (sinusoidal edge-to-center)
- Three states: Normal (base colors), Hover (blended toward buttonHoverColor),
  Pressed (darkened mid, brightened if too close to base)
- Processes color escape sequences in button text for per-character foreground colors
- Symbol substitution: `'*'` characters are replaced with `button.symbol[]` glyphs

**Input loop** (`buttonInputLoop`):
1. Create overlay buffer, draw all buttons
2. Save display buffer, overlay buttons
3. `await nextBrogueEvent()` — wait for input
4. `processButtonInput()` — update focus/depress, check hotkeys
5. Restore buffer, repeat until chosen or cancelled
6. Clicking outside window region cancels

**Menu bar** (`io/menu-bar.ts`): Five persistent bottom-row buttons (Explore,
Rest, Search, Menu, Inventory) drawn every frame via `drawGameMenuButtons()` in
`mainGameLoop`.

**Action menu** (`io/input-mouse.ts`): Popup column of buttons (Rest Until Better,
Autopilot, Re-throw, settings toggles, Feats, Discoveries, Help, Save, Quit) with
`rectangularShading` background. Returns hotkey of chosen action.

### 6. Inventory Screen

**`displayInventory()`** (`io/inventory-display.ts`):
1. Builds ordered item list (equipped first, then pack items)
2. Creates one button per item with: letter, magic indicator glyph, item glyph,
   name, equipped suffix
3. Draws buttons into overlay buffer, positions right-aligned
4. Runs `buttonInputLoop` to select
5. On shift-click or acknowledge mode: shows `printCarriedItemDetails()` side panel
6. Detail panel supports direct actions (Apply, Equip, Unequip, Drop, Throw,
   Relabel, Call) via action key dispatch
7. Up/Down navigation between items within detail view

**`promptForItemOfType()`**: Shows temporary prompt, filters inventory by
category/flags, returns selected Item.

### 7. Targeting UI

**Entry point:** `chooseTarget()` in `items/targeting.ts`.

**Flow:**
1. Auto-target: `canAutoTargetMonster()` finds the best initial target based on
   bolt type, effect, and context
2. `hiliteTrajectory()` — highlights the bolt path from player to target, showing
   where the bolt would stop (monster hit, wall, etc.)
3. `moveCursor()` loop — waits for input: arrow keys to move cursor, tab to cycle
   targets, return to confirm, escape to cancel
4. Each cursor move: erase old path (`hiliteTrajectory(erase=true)`), draw new
   path, refresh sidebar with focused entity, print location description

**`hiliteCell()`** (`io/targeting.ts`): Retrieves cell appearance, applies color
augment, replots.

**`hilitePath()` / `clearCursorPath()`**: Set/clear `IS_IN_PATH` tile flag, refresh
each cell. Path visualization is driven by tile flags rather than overlay buffers.

**`playerCancelsBlinking()`**: Safety check for blink staff — warns about lava,
prompts confirmation.

### 8. Info Panels

**Monster details** (`printMonsterDetails` → `monsterDetails()`): Generates
multi-paragraph text description, rendered via `printTextBox()`.

**Item details** (`printCarriedItemDetails` → `itemDetails()`): Text description
rendered in a side panel next to the inventory.

**Floor item details** (`printFloorItemDetails`): Text box positioned relative to
the item's map location.

**`printTextBox()`** (`io/inventory.ts`):
1. Auto-calculates position and width based on map location (left/right of center)
2. `wrapText()` to fit width, widening if needed to fit within ROWS
3. `rectangularShading()` — applies shaded background with distance-based falloff
4. `overlayDisplayBuffer()` — blends onto screen
5. If buttons provided, positions and runs `buttonInputLoop()`

### 9. Text Rendering

**`printString()`** (`io/text.ts`): Renders string into buffer at (x, y),
interpreting 4-byte color escape sequences (COLOR_ESCAPE + 3 RGB bytes) to change
foreground color mid-string.

**`printStringWithWrapping()`**: Wraps text to width, handling color escapes across
line breaks.

**`wrapText()`**: Word-wrap with color-escape awareness. `breakUpLongWordsIn()`
handles words wider than the available width (with optional hyphens).

**`splitLines()`**: Splits wrapped text into buffer rows, carrying color escapes
across line boundaries.

**`strLenWithoutEscapes()`**: Visible string length (excludes 4-byte color escape
sequences).

### 10. Overlay Screen Panels

`io/overlay-screens.ts` — three full-screen overlay panels:

- **Help screen** (`printHelpScreen`): Keybinding reference, rendered over the
  dungeon area
- **Feats screen** (`displayFeatsScreen`): Achievement list with
  available/achieved/failed status
- **Discoveries screen** (`printDiscoveriesScreen`): Three-column display of
  identified/unidentified scrolls, potions, staffs, wands, rings

All three follow the same pattern:
1. Save display buffer
2. Create overlay, print text, set opacity to `INTERFACE_OPACITY` (skip sidebar
   columns)
3. `applyOverlay()` to blend
4. Await acknowledgment
5. Restore display buffer + `commitDraws()`

### 11. Visual Effects

**Flashes** (`io/effects.ts`):
- `flashCell()` — single cell, fades over N frames
- `flashForeground()` — multiple cells, foreground-only flash with per-cell colors
  and strengths
- `colorFlash()` — expanding radial flash with distance-based intensity falloff

**Fades** (`io/effects.ts`):
- `irisFadeBetweenBuffers()` — radial iris transition between two display buffers
  (for level transitions)
- `funkyFade()` — psychedelic wave-pattern fade with distance weighting (for
  death/victory screens)
- `blendAppearancesCtx()` — per-cell interpolation of glyph + colors

**Alerts** (`io/effects-alerts.ts`):
- `displayCenteredAlert()` — centered teal message at ROWS/2
- `flashMessage()` — animated message with front-loaded fade-in/out
- `flashTemporaryAlert()` — centered version of flashMessage
- `displayMonsterFlashes()` — processes MB_WILL_FLASH on all creatures, dispatches
  to flashForeground

**Flares** (`light/flares.ts`):
- Expanding/contracting light sources for visual feedback (scrolls, explosions)
- `animateFlares()` loop: each frame calls `updateFlare()` (advance coefficient),
  `drawFlareFrame()` (paint light), `pauseAnimation(10)`. Backs up and restores
  lighting each frame.

### 12. Platform Rendering Interface

**`commitDraws()`** (`platform.ts`): Dirty-cell detection — compares
`displayBuffer` against `_prevBuffer`, calls `plotChar()` for changed cells only.

**`plotChar()`** (`platform/browser-renderer.ts`): Computes `CellRect` from
progressive cell sizing, converts 0–100 colors to 0–255, delegates to the active
`Renderer`.

**Two renderers:**
- `TextRenderer` — fills cell background, draws centered Unicode glyph
- `SpriteRenderer` — multi-layer compositing with configurable blend modes per
  layer (terrain, liquid, surface, item, entity, gas, fire, visibility, status,
  bolt, UI). Uses `CellSpriteData` from `getCellSpriteData()`.

**Event model:** `waitForEvent()` → `Promise<RogueEvent>` (async, never blocks).
`pauseAndCheckForEvent(ms)` races a timeout against event arrival.
`mainGameLoop()` alternates between 25ms animation ticks (terrain color shuffle)
and event processing.

## Integration Points

- **Game loop** (`platform.ts`): `mainGameLoop()` → `processEvent()` →
  `handleKeystroke()` / `handleLeftClick()` / `handleHover()` →
  `executeKeystroke()` → game actions that may call into any UI subsystem
- **DI contexts**: Each UI subsystem defines its own context interface
  (MessageContext, SidebarContext, ButtonContext, InventoryContext, EffectsContext,
  TargetingContext, ChooseTargetContext). `buildInputContext()`
  (`io/input-context.ts`) is the master wiring point that constructs all of these
  from live game state.
- **`ui.ts`**: Provides `buildButtonContext()`, `buildInventoryContext()`,
  `buildMessageContext()` factories used by the input context builder.
- **`io-wiring.ts`**: Provides `buildMessageFns()`, `buildRefreshDungeonCellFn()`,
  `buildHiliteCellFn()`, `buildRefreshSideBarFn()`, `buildDisplayLevelFn()`.

## Constraints & Invariants

1. **All coordinates are in two spaces:** window coordinates (0–99 × 0–33) for
   rendering, map/dungeon coordinates (0–78 × 0–28) for game logic. Always convert
   via `mapToWindow()` / `windowToMap()`.
2. **Color scale is 0–100** (Brogue convention), not 0–255. The platform renderer
   converts at the boundary.
3. **Overlay buffers must be balanced:** every `saveDisplayBuffer()` must have a
   matching `restoreDisplayBuffer()`. Leaking a save causes visual corruption.
4. **`opacity = 0` means transparent** in overlay blending — cells with opacity 0
   are skipped entirely.
5. **Color escapes are 4 bytes:** `COLOR_ESCAPE` (0x01) + R + G + B. Any string
   measurement or manipulation must account for these.
6. **The display buffer is the single source of truth** for what the player sees.
   All rendering writes to it; `commitDraws()` flushes it to the canvas.
7. **Button input is always async** — `buttonInputLoop` and all functions that wait
   for player input use `await`.
8. **Message folding** only applies to FOLDABLE messages from the same turn.
   Non-foldable messages are never combined.

## Modification Notes

- **Adding a new overlay screen:** Follow the pattern in `overlay-screens.ts` —
  save buffer, create overlay with `INTERFACE_OPACITY`, blend, await, restore,
  `commitDraws()`.
- **Adding sidebar content:** Modify `collectSidebarEntities()` to include new
  entity types, add a new `printXxxInfo()` rendering function.
- **Custom button menus:** Use `buttonInputLoop()` with an array of
  `BrogueButton`. Set `B_WIDE_CLICK_AREA` for bottom-bar buttons. The sinusoidal
  gradient (`smoothHiliteGradient`) applies automatically when `B_GRADIENT` is set.
- **New visual effects:** Use `EffectsContext` for DI. `pauseAnimation()` should be
  used for frame delays (respects playback speed). Always check
  `rogue.playbackFastForward` before expensive animation loops.
- **The 600-line file limit applies.** If adding significant UI code, check the
  target file's length and split proactively.
- **Context interfaces are large** — `ChooseTargetContext` has 30+ methods. When
  extending, prefer adding to existing contexts over creating new ones.
