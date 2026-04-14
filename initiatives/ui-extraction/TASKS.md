# UI Extraction — Tasks

## Phase 1: Layout + Sidebar

- [x] Audit full-grid visual effects: enumerate all functions that write
  to the full 100×34 buffer (`blackOutScreen`, `irisFadeBetweenBuffers`,
  `colorOverDungeon`, death screen fade in `deathFadeAsync`). Document
  how each will need to interact with DOM elements post-extraction.
  Record findings in PLAN.md Technical Notes.
- [x] Create HTML layout in `index.html`: flexbox container with sidebar
  region (left), canvas + message + bottom bar region (right). Style
  with dark background, monospace font. Canvas retains current sizing
  logic for now.
- [x] Create `platform/ui-sidebar.ts`: DOM rendering module for the
  sidebar. Functions: `initSidebarDOM(container)`, `renderSidebar(data)`.
- [x] Extract sidebar data interface: define a `SidebarRenderData` type
  that captures everything needed to render the sidebar (player stats,
  entity list with names/glyphs/colors, health percentages, depth).
  Keep it serializable (plain objects, no functions or closures).
- [x] Implement `renderSidebar`: creates/updates DOM elements for player
  stats block (HP bar, nutrition, str, armor, gold, stealth), entity
  list entries (glyph + name with colors), and depth footer.
- [x] Implement progress bars as styled `<div>` elements with percentage
  fill widths, matching current 20-column bar appearance.
- [x] Wire `refreshSideBar` call sites to produce `SidebarRenderData`
  and call `renderSidebar` instead of (or in addition to) buffer writes.
  Gate behind a `useDOM` flag so the buffer-write path remains as
  fallback. Verify sidebar appears in HTML and matches canvas version.
- [x] Add data attributes to sidebar entity DOM elements mapping to
  `sidebarLocationList` positions, so hover interaction continues to work.
- [x] Wire sidebar DOM hover events to trigger dungeon cell highlighting
  (reuse existing hover handler pathway). Also wire canvas dungeon cell
  hover to update sidebar DOM highlighting (reverse direction).
- [x] Suppress canvas rendering of sidebar columns (0–20) during
  gameplay — fill with black or skip in `plotChar`.
- [x] Verify: gameplay with HTML sidebar, canvas dungeon, all
  interactions (hover highlight, entity click) working.
- [x] 🔄 Handoff

# --- handoff point ---

## Phase 2: Messages + Bottom Bar

- [x] Create `platform/ui-messages.ts`: DOM rendering module for the
  message area. Functions: `initMessagesDOM(container)`,
  `renderMessages(messages)`, `showMoreSign()`, `hideMoreSign()`.
- [x] Extract message display data: define types for message content
  with color markup (reuse existing color escape processing).
- [x] Implement `renderMessages`: updates a message container with
  styled text spans, preserving Brogue's color escape sequences as
  inline CSS colors.
- [x] Wire `updateMessageDisplay` to call DOM renderer instead of
  buffer writes (gated behind `useDOM` flag). Verify messages appear
  in HTML.
- [x] Implement message archive as a scrollable panel (CSS overflow-y)
  with slide-in animation (CSS transition), replacing the
  buffer-animated `displayMessageArchive`. The archive currently uses
  a custom `nextBrogueEvent` loop with up/down/page keys and mouse
  wheel — the DOM version replaces this with native scroll + keyboard
  listeners on the scrollable container.
- [x] Create `platform/ui-bottom-bar.ts`: DOM rendering for game menu
  buttons and flavor text line.
- [x] Implement bottom bar buttons as styled `<button>` elements with
  the same labels and hotkeys. Wire click events to the same actions
  as the current `findClickedMenuButton` dispatch. Note:
  `drawGameMenuButtons` currently uses `applyOverlay` — the DOM
  version replaces this entirely.
- [x] Implement flavor text line as a `<div>` updated by `flavorMessage`.
- [x] Suppress canvas rendering of message rows (0–2) and bottom rows
  (32–33) during gameplay.
- [x] Verify: messages, --MORE-- prompt, message archive, bottom bar
  buttons, and flavor text all working in HTML.
- [x] 🔄 Handoff

# --- handoff point ---

## Phase 3: Overlay Modals

Extraction order is leaf-to-root: simple overlays first, then
overlays that nest others. This avoids mixed-mode issues where
a parent overlay is DOM but a child is still buffer-based.

### Phase 3a: Modal Infrastructure + Simple Dismissables

- [x] Create `platform/ui-modal.ts`: generic modal infrastructure.
  Functions: `showModal(content, options)`, `hideModal()`. Supports
  backdrop dimming (semi-transparent overlay `<div>` over canvas),
  keyboard/mouse event capture (suppresses canvas event listeners
  while modal is active), async result promise. All modals are
  viewport-centered (`position: fixed`).
- [x] Convert `printHelpScreen` to HTML modal: scrollable text panel
  with key binding list. Dismiss on any key/click. This validates
  the modal infrastructure with the simplest input pattern.
- [x] Convert `displayFeatsScreen` to HTML modal: table of feats with
  completion status. Dismiss on any key/click.
- [x] Convert `printDiscoveriesScreen` to HTML modal: multi-column
  discoveries list. Dismiss on any key/click.
- [x] Verify: help, feats, discoveries all open/dismiss correctly.
- [x] 🔄 Handoff

# --- handoff point ---

### Phase 3b: Alerts + Text Boxes

- [x] Convert alert functions (`flashTemporaryAlert`,
  `displayCenteredAlert`) to HTML toast/overlay with CSS fade
  animation and `setTimeout`. `flashTemporaryAlert` currently
  snapshots individual cells and animates with `pauseBrogue` —
  the DOM version is a positioned `<div>` with opacity transition.
- [x] Convert `printTextBox` (without buttons) to HTML modal: text
  content in a styled centered panel. This validates the shading/
  backdrop replacement — DOM uses a simple backdrop `<div>` instead
  of `rectangularShading`'s distance-based opacity falloff.
- [x] Convert `printTextBox` (with buttons) to HTML modal: same panel
  plus styled `<button>` elements. DOM click/keyboard handlers
  resolve the async promise with the button index. This is the
  first `buttonInputLoop` replacement — validate carefully.
- [x] Convert `confirm` dialog (`input-dispatch.ts`,
  `io-wiring.ts` `buildConfirmFn`): these wrap `printTextBox` with
  save/restore. After extraction, `confirm` calls `printTextBox`
  (now DOM) and the save/restore of the display buffer becomes
  unnecessary for the modal itself (but may still be needed for
  underlying canvas state). Verify critical confirm dialogs:
  throw item, descend stairs, quit game.
- [x] Convert text entry dialog (`getInputTextString` with
  `useDialogBox: true`): replace `rectangularShading` + custom
  keystroke loop with a DOM modal containing an `<input>` element.
  Used for item inscription and seed entry.
- [x] Verify: all text boxes, confirms, text entry, and alerts work.
- [x] 🔄 Handoff

# --- handoff point ---

### Phase 3c: System Menu + Item Details

- [x] Convert system/escape menu (`actionMenu` in `input-mouse.ts`):
  replace `rectangularShading` + `buttonInputLoop` + save/restore
  with a DOM modal. Has variant buttons for playback mode — verify
  both gameplay and playback menu states.
- [x] Convert `printCarriedItemDetails` (`ui-inventory.ts`): detail
  panel with `buttonInputLoop` for action dispatch (apply, equip,
  drop, throw, relabel, call). DOM version: styled panel with
  action buttons. Must preserve the full `ButtonInputResult` return
  (chosen button + event) since `displayInventory` checks
  `event.shiftKey`.
- [x] Convert `printMonsterDetails` (`sidebar-monsters.ts`) and
  `printFloorItemDetails` (`sidebar-player.ts`): these call
  `printTextBox` (now DOM) during cursor/examine mode. The parent
  cursor loop in `input-cursor.ts` does save/restore around these
  calls — verify the save/restore still works correctly when the
  detail is a DOM panel (it should: save/restore handles canvas
  content, DOM panel lifecycle is independent).
- [x] Verify: escape menu, item detail actions (equip/drop/throw
  from inventory detail), monster/item popups during examine mode.
- [x] 🔄 Handoff

# --- handoff point ---

### Phase 3d: Inventory

- [x] Convert `displayInventory` to HTML modal: item list as styled
  rows with glyph/name/letter. Requirements:
  - Letter-key selection (a-z maps to inventory slots)
  - Shift/control click or keypress triggers drill-down to item
    detail (now DOM via Phase 3c)
  - Up/down arrow navigation with wrap (currently invisible nav
    buttons in `buttonInputLoop`)
  - Click-to-select on item rows
  - Click outside modal to cancel
  - Escape to cancel
  - Pack space hint and instruction text when `waitForAcknowledge`
  - Equipped item separator line
- [x] Implement inventory drill-down: when an item is selected with
  modifier or in acknowledge mode, show `printCarriedItemDetails`
  (DOM, from Phase 3c). Up/down arrows in detail view cycle items
  without closing the inventory. Return to list on dismiss.
- [x] Verify inventory in all call contexts: pick up item (choose
  slot), apply item, equip/unequip, throw, drop, examine (from
  sidebar), death screen inventory review.
- [x] Verify `InputContext.buttonInputLoop` return type: some callers
  need only `chosenButton` (number), others need the full
  `ButtonInputResult` (chosenButton + event). Ensure the DOM
  replacement provides both where needed.
- [x] 🔄 Handoff

# --- handoff point ---

## Phase 4: Canvas Resize + Cleanup

**Hard prerequisite:** All Phase 3 sub-phases must be complete. Any
remaining buffer-based overlay that addresses the full 100×34 grid
will break after the canvas is resized to dungeon-only.

- [x] Modify `sizeCanvas` to size the canvas for dungeon-only
  dimensions (DCOLS × DROWS cells) instead of the full COLS × ROWS
  grid during gameplay.
- [x] Update `plotChar` coordinate mapping: dungeon cells map directly
  to canvas coordinates without the sidebar/message offset.
- [x] Update mouse coordinate mapping: canvas clicks map directly to
  dungeon cell coordinates.
- [x] Update `mapToWindowX` / `mapToWindowY` usage — audit all call
  sites that assume the old 100×34 buffer layout for screen positioning.
- [x] Implement canvas mode switching: main menu uses full 100×34
  canvas, gameplay uses dungeon-only canvas. Handle the transition
  on game start, game end, and return to menu. Verify the menu →
  gameplay → menu cycle (new game, die, return to menu).
- [x] Gate buffer-write code paths for sidebar, messages, bottom bar,
  and extracted overlays behind the `useDOM` flag. Verify both modes
  (DOM and fallback) still work.
- [x] Verify: complete gameplay session, all phases working, no
  rendering artifacts.
- [x] 🔄 Handoff

# --- handoff point ---

## Phase 5: Polish

- [x] Verify all game modes: new game, continue, playback, wizard mode.
- [x] Verify visual effects that span UI regions (from Phase 1 audit):
  `blackOutScreen`, `colorOverDungeon`, `irisFadeBetweenBuffers`,
  death screen fade (`deathFadeAsync`), level transition animations.
  Each must correctly interact with both canvas and DOM elements.
- [x] Verify death screen: `runDeathScreen` uses `copyDisplayBuffer`
  for fade, then optionally opens `displayInventory` (now DOM).
- [x] Verify playback mode: action menu has different buttons, menu
  bar has playback labels. Both should work with DOM extraction.
- [x] Test at various viewport sizes — sidebar and messages should
  remain readable while dungeon scales.
- [x] Performance check: DOM updates should not cause jank during
  rapid sidebar refreshes (e.g., combat with many visible monsters).
- [x] 🔄 Handoff

## Deferred

- Continue / Playback / Recording modes: require `openFile` implementation (DEFER: port-v2-persistence). DOM extraction is already wired for these modes; they will work once `openFile` is implemented.
- `irisFadeBetweenBuffers` caller: level-transition iris animation is not yet called from game code. When implemented, caller must call `setSidebarVisible(false)` before and `setSidebarVisible(true)` after (documented in JSDoc on the function).
- `_renderEntityList` diff-update optimisation: current clear-and-rebuild is acceptable for ≤15 entities. Future optimisation: diff entities against previous render to avoid full rebuild.

---

## Post-Playtesting Fixes

Bugs discovered during playtesting of the fully extracted UI. Fixed after Phase 5 completion.

- [x] **Bug 1: Bottom bar buttons do nothing when clicked.** Root cause: click callback was injecting `MouseUp` events routed through `findClickedMenuButton` coordinate hit-test, which could fail due to dungeon-only canvas coordinate remapping. Fix: inject `Keystroke` events directly for buttons that have hotkeys; fall back to `MouseUp` injection only for the Menu button (no hotkey, triggers `actionMenu`). (`platform.ts`)

- [x] **Bug 2: Hotkey letters display with `}` chars around them.** Root cause: local `_parseButtonLabel` function in `ui-bottom-bar.ts` duplicated parsing logic that may behave differently from the proven `parseColorEscapes` in `ui-messages.ts`. Fix: replaced `_parseButtonLabel` with a wrapper that delegates to `parseColorEscapes(raw, 1.0)` and maps segments to `_Segment` by checking if the CSS color string is pure white. (`platform/ui-bottom-bar.ts`)

- [x] **Bug 3: ASCII mode — DOM elements stay visible but stop updating.** Root cause: `setGraphicsMode` called `setDOMXxxEnabled(useDOM)` but did not call `setXxxVisible(useDOM)` to hide the DOM elements. Fix: when `_menuState !== null` (gameplay is active), also call `setSidebarVisible/setMessagesVisible/setBottomBarVisible(useDOM)`. (`platform.ts`)

- [x] **Bug 4: Relabel crashes the game.** Root cause: `relabel()` calls `waitForEvent()` directly to get a keystroke, which conflicts with the DOM inventory modal's own event listeners. Fix: when `isDOMModalEnabled()`, use `showInputModal("New inventory letter?", "", 1, false)` to get the new label via an HTML input, bypassing `waitForEvent()`. (`io/inventory-actions.ts`)

- [x] **Bug 5 (CSS): Messages/bottom-bar containers clip content.** Root cause: both `#brogue-messages` and `#brogue-bottom-bar` had `overflow: hidden`, clipping the message archive panel (which expands below the messages container) and tall flavor-text+button rows. Fix: changed both to `overflow: visible`; added `box-sizing: border-box`. (`index.html`)

- [ ] **Bug 5 (--MORE-- sign not showing):** `displayMoreSign` only fires when `REQUIRE_ACKNOWLEDGMENT` or `cautiousMode` is set — correct C parity. Regular game messages do not trigger `--MORE--`. No change needed. (by design)

- [ ] **Bug 5 (message archive Shift+M):** `displayMessageArchive` returns early when `length <= MESSAGE_LINES` (≤3 messages in archive) — correct C parity. After a few game turns the archive opens normally. Archive panel was additionally clipped by `overflow:hidden` — fixed by Bug 5 CSS fix above.
