# UI Extraction — Tasks

## Phase 1: Layout + Sidebar

- [ ] Create HTML layout in `index.html`: flexbox container with sidebar
  region (left), canvas + message + bottom bar region (right). Style
  with dark background, monospace font. Canvas retains current sizing
  logic for now.
- [ ] Create `platform/ui-sidebar.ts`: DOM rendering module for the
  sidebar. Functions: `initSidebarDOM(container)`, `renderSidebar(data)`.
- [ ] Extract sidebar data interface: define a `SidebarRenderData` type
  that captures everything needed to render the sidebar (player stats,
  entity list with names/glyphs/colors, health percentages, depth).
- [ ] Implement `renderSidebar`: creates/updates DOM elements for player
  stats block (HP bar, nutrition, str, armor, gold, stealth), entity
  list entries (glyph + name with colors), and depth footer.
- [ ] Implement progress bars as styled `<div>` elements with percentage
  fill widths, matching current 20-column bar appearance.
- [ ] Wire `refreshSideBar` call sites to produce `SidebarRenderData`
  and call `renderSidebar` instead of (or in addition to) buffer writes.
  Verify sidebar appears in HTML and matches canvas version.
- [ ] Add data attributes to sidebar entity DOM elements mapping to
  `sidebarLocationList` positions, so hover interaction continues to work.
- [ ] Wire sidebar DOM hover events to trigger dungeon cell highlighting
  (reuse existing hover handler pathway).
- [ ] Suppress canvas rendering of sidebar columns (0–20) during
  gameplay — fill with black or skip in `plotChar`.
- [ ] Verify: gameplay with HTML sidebar, canvas dungeon, all
  interactions (hover highlight, entity click) working.
- [ ] Commit Phase 1

# --- handoff point ---

## Phase 2: Messages + Bottom Bar

- [ ] Create `platform/ui-messages.ts`: DOM rendering module for the
  message area. Functions: `initMessagesDOM(container)`,
  `renderMessages(messages)`, `showMoreSign()`, `hideMoreSign()`.
- [ ] Extract message display data: define types for message content
  with color markup (reuse existing color escape processing).
- [ ] Implement `renderMessages`: updates a message container with
  styled text spans, preserving Brogue's color escape sequences as
  inline CSS colors.
- [ ] Wire `updateMessageDisplay` to call DOM renderer instead of
  buffer writes. Verify messages appear in HTML.
- [ ] Implement message archive as a scrollable panel (CSS overflow-y)
  with slide-in animation (CSS transition), replacing the
  buffer-animated `displayMessageArchive`.
- [ ] Create `platform/ui-bottom-bar.ts`: DOM rendering for game menu
  buttons and flavor text line.
- [ ] Implement bottom bar buttons as styled `<button>` elements with
  the same labels and hotkeys. Wire click events to the same actions
  as the current `findClickedMenuButton` dispatch.
- [ ] Implement flavor text line as a `<div>` updated by `flavorMessage`.
- [ ] Suppress canvas rendering of message rows (0–2) and bottom rows
  (32–33) during gameplay.
- [ ] Verify: messages, --MORE-- prompt, message archive, bottom bar
  buttons, and flavor text all working in HTML.
- [ ] Commit Phase 2

# --- handoff point ---

## Phase 3: Overlay Modals

- [ ] Create `platform/ui-modal.ts`: generic modal infrastructure.
  Functions: `showModal(content, options)`, `hideModal()`. Supports
  backdrop dimming, keyboard/mouse event capture, async result promise.
- [ ] Convert `printTextBox` to HTML modal: text content in a styled
  panel, optional buttons, auto-positioned or centered. Returns the
  same result (button index or dismiss) via async promise.
- [ ] Convert `displayInventory` to HTML modal: item list as styled
  rows with glyph/name/letter, keyboard navigation (up/down/letter
  keys), click-to-select. Replace `buttonInputLoop` with DOM event
  listeners resolving the selection promise.
- [ ] Convert `printHelpScreen` to HTML modal: scrollable text panel
  with key binding list.
- [ ] Convert `displayFeatsScreen` to HTML modal: table of feats with
  completion status.
- [ ] Convert `printDiscoveriesScreen` to HTML modal: multi-column
  discoveries list.
- [ ] Convert alert functions (`flashTemporaryAlert`,
  `displayCenteredAlert`) to HTML toast/overlay with fade animation.
- [ ] Verify: all overlay interactions (inventory selection, help
  dismiss, text box buttons) work correctly via DOM events.
- [ ] Commit Phase 3

# --- handoff point ---

## Phase 4: Canvas Resize + Cleanup

- [ ] Modify `sizeCanvas` to size the canvas for dungeon-only
  dimensions (DCOLS × DROWS cells) instead of the full COLS × ROWS
  grid during gameplay.
- [ ] Update `plotChar` coordinate mapping: dungeon cells map directly
  to canvas coordinates without the sidebar/message offset.
- [ ] Update mouse coordinate mapping: canvas clicks map directly to
  dungeon cell coordinates.
- [ ] Update `mapToWindowX` / `mapToWindowY` usage — audit all call
  sites that assume the old 100×34 buffer layout for screen positioning.
- [ ] Verify the main menu still works (it should use the full canvas
  size or its own sizing).
- [ ] Remove dead buffer-write code paths for sidebar, messages, and
  bottom bar regions (or gate them behind a flag for fallback).
- [ ] Verify: complete gameplay session, all phases working, no
  rendering artifacts.
- [ ] Commit Phase 4

# --- handoff point ---

## Phase 5: Polish

- [ ] Verify all game modes: new game, continue, playback, wizard mode.
- [ ] Verify visual effects that span UI regions: `blackOutScreen`,
  `colorOverDungeon`, level transition animations.
- [ ] Test at various viewport sizes — sidebar and messages should
  remain readable while dungeon scales.
- [ ] Performance check: DOM updates should not cause jank during
  rapid sidebar refreshes (e.g., combat with many visible monsters).
- [ ] Commit Phase 5
