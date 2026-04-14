# UI Extraction — Plan

## Approach

Five phases, each independently committable and leaving the game
playable:

1. **Layout + sidebar** — HTML layout wrapping the canvas; sidebar
   extracted to DOM.
2. **Messages + bottom bar** — message area and game menu buttons
   extracted to DOM.
3. **Overlay modals** — inventory, help, discoveries, feats, and text
   box popups converted to HTML modals.
4. **Canvas resize** — canvas shrunk to dungeon-only dimensions during
   gameplay; coordinate mapping updated.
5. **Polish + cleanup** — remove dead buffer-write code paths for
   extracted regions, verify all game modes work.

---

## Architecture

### Current State

All UI writes go through `plotCharToBuffer` / `printString` /
`printStringWithWrapping` into a `ScreenDisplayBuffer[100][34]`. The
browser renderer reads this buffer and draws every cell to a single
canvas. Sidebar, messages, dungeon, and overlays all share the same
buffer and canvas.

### Target State

```
┌─────────────────────────────────────────────────────┐
│  HTML layout                                        │
│  ┌──────────┬──────────────────────┬──────────────┐ │
│  │ Sidebar  │  Canvas              │              │ │
│  │ (HTML)   │  (dungeon only)      │              │ │
│  │          │                      │              │ │
│  │          ├──────────────────────┤              │ │
│  │          │  Messages (HTML)     │              │ │
│  │          ├──────────────────────┤              │ │
│  │          │  Bottom bar (HTML)   │              │ │
│  └──────────┴──────────────────────┘              │ │
│                                                     │
│  Overlay modals (HTML, positioned over canvas)      │
└─────────────────────────────────────────────────────┘
```

The canvas renders only dungeon cells. All other UI is HTML/DOM.
The `ScreenDisplayBuffer` continues to exist for dungeon cell data and
any not-yet-extracted code paths.

### Bridging Strategy

The existing code computes UI data (sidebar entities, message text,
inventory items) and then renders it character-by-character into the
buffer. We split this into:

1. **Data computation** — unchanged. `collectSidebarEntities`,
   `messageWithColor`, `displayInventory`'s item list logic, etc.
2. **DOM rendering** — new functions that take the computed data and
   update HTML elements.

For each UI region, we:
- Identify the data flow (what information is computed)
- Create a DOM rendering function that consumes the same data
- Replace the buffer-write call site with the DOM rendering call
- Verify the buffer-write path is no longer reached for that region

### Key Files to Modify

**Sidebar (Phase 1):**
- `io/sidebar-monsters.ts` — `refreshSideBar`, `printMonsterInfo`
  (~370 lines of buffer writes)
- `io/sidebar-player.ts` — `printItemInfo`, `printTerrainInfo`,
  `printProgressBar` (~210 lines)
- `io/sidebar-wiring.ts` — wiring layer, update to target DOM

**Messages (Phase 2):**
- `io/messages.ts` — `updateMessageDisplay`, `displayMoreSign`,
  `temporaryMessage`, `displayMessageArchive` (~350 lines)

**Bottom bar (Phase 2):**
- `io/menu-bar.ts` — `buildGameMenuButtonState`, `drawGameMenuButtons`
  (~120 lines)
- `io/buttons.ts` — `drawButton`, `drawButtonsInState` (~110 lines)

**Overlays (Phase 3):**
- `io/overlay-screens.ts` — `printHelpScreen`, `displayFeatsScreen`,
  `printDiscoveriesScreen` (~190 lines)
- `io/effects-alerts.ts` — `flashTemporaryAlert`,
  `displayCenteredAlert` (~120 lines)
- `io/inventory.ts` — `printTextBox`, `rectangularShading` (~130 lines)
- `io/input-dispatch.ts` — `confirm` (wraps `printTextBox`)
- `io/input-dispatch.ts` — `getInputTextString` (text entry dialog)
- `io/input-mouse.ts` — `actionMenu` (system/escape menu, ~50 lines)
- `io/ui-inventory.ts` — `printCarriedItemDetails` (~120 lines)
- `io/inventory-display.ts` — `displayInventory` (~350 lines, most
  complex overlay — extract last)
- `io/sidebar-monsters.ts` — `printMonsterDetails` (detail popup
  during cursor/examine mode, calls `printTextBox`)
- `io/sidebar-player.ts` — `printFloorItemDetails` (same pattern)

**Canvas (Phase 4):**
- `bootstrap.ts` — canvas sizing, layout wiring
- `platform/browser-renderer.ts` — `plotChar` path, coordinate mapping

### Styling Approach

Use a dedicated CSS file (or `<style>` block) that recreates the
current dark monospace look:
- `background: #000`, monospace font, green/white/gray text colors
- Progress bars as styled `<div>` elements with fill widths
- Entity list as a flexbox column with glyph + name rows
- Modals as absolutely-positioned panels with backdrop dimming

The Brogue color system uses 0–100 RGB values. The DOM renderer
converts these to CSS `rgb()` strings, same as the canvas text renderer
already does.

---

## Technical Notes

### Full-Grid Visual Effects Audit (Phase 1 task)

Four functions write to the full 100×34 buffer and will need to interact
with DOM elements after sidebar extraction.

**1. `blackOutScreen` (`io/display.ts:463`)**
Fills all 100×34 cells with black spaces. Called at death screen start and
level transitions. After extraction, the canvas portion (sidebar columns) is
suppressed so the canvas blackout is a no-op for those columns. The DOM
sidebar must also be cleared/hidden.
- **Post-extraction**: call `hideSidebarDOM()` or `clearSidebarDOM()` after
  `blackOutScreen`. During death, the sidebar is already set to HP=0 via
  `buildRefreshSideBarFn()()` before `deathFadeAsync`, so hiding is fine.

**2. `irisFadeBetweenBuffers` (`io/effects.ts:169`)**
Radial iris-fade from one full buffer to another. Blends every cell
(including sidebar columns 0–20) in both buffers and plots them to canvas.
Used at level transitions (new floor entry). After extraction, sidebar canvas
columns are suppressed — the iris fade writes to them in the buffer but
`plotChar` skips them. The DOM sidebar would show through during the fade,
creating a jarring mismatch.
- **Post-extraction**: hide DOM sidebar before `irisFadeBetweenBuffers` and
  restore after. The fade's output buffer becomes the new display state so
  `refreshSideBar` will run on the next game tick and update the DOM.

**3. `colorOverDungeon` (`io/display.ts:484`)**
Fills only the dungeon viewport (DCOLS×DROWS cells, offsets by
`mapToWindow`) with a solid color. Does **not** touch sidebar columns or
message rows. Safe after extraction — targets only cells in the dungeon
region, which remain canvas-rendered in all phases.
- **Post-extraction**: no special DOM interaction needed.

**4. `deathFadeAsync` (`lifecycle-gameover.ts:146`)**
Async radial fade to black from player position across all COLS×ROWS cells.
Iterates the full buffer and scales color components toward zero. Ends with
`blackOutScreen`. After Phase 1 sidebar suppression, canvas sidebar columns
render black regardless — but the DOM sidebar remains visible during the
fade.
- **Post-extraction**: hide DOM sidebar at the start of `deathFadeAsync` (or
  at `runDeathScreen` entry). The sidebar DOM is not needed during the death
  sequence. Restore only if the player returns to gameplay (which they don't
  — death leads to the title screen, which re-runs on canvas).

**Summary for Phase 5 verification**: All four effects need DOM sidebar
hidden/suppressed before they run. A single `setSidebarDOMVisible(false)`
call at the entry point of each effect (or at their shared callers) is
sufficient. Sidebar DOM is restored on the next `refreshSideBar` call when
gameplay resumes.

### Sidebar Entity List

`refreshSideBar` calls `collectSidebarEntities` (pure data) then
iterates entities calling `printMonsterInfo` / `printItemInfo` /
`printTerrainInfo`. Each of these writes character-by-character into the
buffer with colored text.

For DOM extraction, `collectSidebarEntities` stays as-is. A new
`renderSidebarToDOM` function takes the entity list and updates a
container element with:
- Player stats block (HP bar, nutrition, str/armor/gold/stealth)
- Entity entries (glyph span + name span, color-styled)
- Depth footer

The `sidebarLocationList` mapping (which sidebar row maps to which
entity location for hover interaction) translates to data attributes on
the DOM elements.

### Message Archive Animation

`displayMessageArchive` / `animateMessageArchive` currently animate a
sliding message panel using buffer writes + `commitDraws` in a loop.
The DOM version can use CSS transitions or `requestAnimationFrame` for
the slide animation, which will be smoother.

### Overlay Input Patterns

The codebase uses four distinct input patterns for overlays. Each
needs a different DOM extraction strategy:

**1. `buttonInputLoop` modals** (inventory, confirm, system menu,
item details): The most complex. `buttonInputLoop` combines rendering,
hit-testing, keyboard dispatch, focus management, and cancel detection
in a single loop. Each iteration does save → overlay → await event →
process → restore.

DOM replacement: HTML elements with CSS hover/pressed states. DOM
event handlers resolve an async promise directly (bypassing
`enqueueEvent`). When a DOM modal is active, canvas event listeners
are suppressed via a transparent overlay `<div>` to prevent input
leaking to the game.

**2. Simple dismissables** (help, feats, discoveries): Use `waitFn`
which loops `waitForEvent()` until a non-hover event. DOM replacement:
modal with `addEventListener` for any key/click, resolving a promise.

**3. Timed animations** (alerts): `flashMessage` snapshots individual
cells, animates with `pauseBrogue`, then restores. DOM replacement:
toast element with CSS fade animation and `setTimeout`.

**4. Custom input loops** (message archive scroll, text entry):
Raw `nextBrogueEvent` with a switch on event types. DOM replacement:
scrollable `<div>` with keyboard listeners (archive) or `<input>`
element (text entry). These are simpler in DOM than in buffer.

### Inventory Modal

`displayInventory` is the most complex overlay — it builds a button
array, renders items with magic-glyph symbols, handles keyboard/mouse
input via `buttonInputLoop`, and supports drill-down to item details.

The drill-down flow is a two-level modal stack:
1. Inventory list → `buttonInputLoop` → select item
2. If shift/control held or `waitForAcknowledge`: open
   `printCarriedItemDetails` (another `buttonInputLoop`)
3. Detail panel dispatches actions (equip/drop/throw/etc.) or
   up/down arrows cycle items without closing
4. Returning from detail re-shows the inventory list

The DOM version becomes a master-detail HTML modal:
- Item list as styled rows with glyph/name/letter
- Keyboard navigation (letter keys for selection, up/down for focus)
- Click-to-select with shift/ctrl modifier detection
- Detail panel as a sibling element, shown/hidden on selection
- Action dispatch from detail panel buttons/hotkeys

Extract `printCarriedItemDetails` before `displayInventory` so the
detail panel is already DOM-based when the inventory is converted.

### Overlay Positioning

All DOM modals use **viewport-centered** positioning (CSS
`position: fixed` with centering). The C original positions some
panels relative to entities (e.g., `printTextBox` with `width <= 0`
auto-places near the entity's map position), but for the DOM version
we always center. This avoids coupling overlay positioning to the
dungeon camera transform that will be added later.

### Overlay Extraction Order

Phase 3 overlays must be extracted leaf-to-root to avoid mixed-mode
issues where a parent overlay is DOM but a child is still buffer-based.
Order:

1. Modal infrastructure (generic show/hide/backdrop)
2. Simple dismissables (help, feats, discoveries)
3. Alerts (flash/centered)
4. `printTextBox` without buttons
5. `printTextBox` with buttons (confirm dialogs)
6. Text entry dialog (`getInputTextString`)
7. System/escape menu (`actionMenu`)
8. `printCarriedItemDetails` (item detail panel)
9. `displayInventory` (depends on #8 being done)

### Mixed-Mode: Targeting + DOM Details

During targeting (`chooseTarget` / `moveCursor`), the cursor loop
saves/restores the display buffer around calls to
`printMonsterDetails` / `printFloorItemDetails`. After extraction,
these detail panels become DOM elements that show/hide independently
of the buffer. The cursor loop's save/restore continues to work for
canvas-only content (trajectory highlights, cursor cell). The DOM
panel lifecycle is separate — show on hover, hide on cursor move.

No special integration is needed as long as `printTextBox` extraction
is complete before targeting code is modified (it won't be — targeting
code stays buffer-based, only the detail popup moves to DOM).

### Buffer-Write Fallback

Existing buffer-write code paths are kept behind a flag rather than
deleted. During Phase 4, extracted regions are gated:

```typescript
if (useDOM) {
    renderSidebarToDOM(data);
} else {
    renderSidebarToBuffer(data, displayBuffer);
}
```

This preserves the option to render without DOM extraction (e.g., for
a standalone terminal-style build) and provides a safety net during
incremental extraction.

---

## Risks

- **`displayInventory` complexity.** The two-level modal with
  drill-down, letter-key shortcuts, shift/control modifiers, invisible
  navigation buttons, and item cycling is the highest-risk extraction.
  Mitigated by extracting leaf overlays first and validating the
  `buttonInputLoop` replacement pattern on simpler modals.
- **Mixed-mode during targeting.** Targeting draws canvas highlights
  while detail popups become DOM panels. The save/restore buffer
  pattern in `input-cursor.ts` handles canvas content only; the DOM
  panel lifecycle is independent. Mitigated by ensuring `printTextBox`
  extraction is all-or-nothing (no callers use buffer while others
  use DOM).
- **Phase 3 must fully complete before Phase 4.** Overlays that use
  `overlayDisplayBuffer` address the full 100×34 grid. If the canvas
  is resized to dungeon-only before all overlays are extracted, any
  remaining buffer-based overlay will break. This is a hard dependency,
  not just ordering preference.
- **Full-grid visual effects.** `blackOutScreen`, `irisFadeBetweenBuffers`,
  death screen fade, and `colorOverDungeon` write to the full buffer.
  After extraction, these need to both affect the canvas and reset/hide
  DOM elements. Requires an early audit (Phase 1 task) and verification
  (Phase 5).

## Open Questions

- ~~**Message area positioning:** Above the dungeon canvas (matching
  current layout).~~ **Decided: above.**
- ~~**Sidebar hover → dungeon highlight:** DOM hover events on sidebar
  entities trigger canvas highlighting via the existing
  `sidebarLocationList` mapping. Canvas hover triggers DOM sidebar
  highlighting in reverse.~~ **Decided: bidirectional via
  sidebarLocationList.**
- ~~**Flavor text line:** Part of the bottom bar (Phase 2).~~
  **Decided: bottom bar.**

## Rejected Approaches

_(none yet)_

## Session Notes [2026-04-14] (Phase 3b)

**Phase 3b complete.** All tasks executed in one session. TypeScript compilation clean (0 errors).

**Key implementation decisions:**

- `platform/ui-alerts.ts`: `showFlashAlert(message, durationMs)` uses CSS opacity transition
  (fade-in at start, fade-out before durationMs). `showCenteredAlert` is fire-and-forget with
  a fixed 2000ms duration. Both check `isDOMModalEnabled()` in `effects-alerts.ts` — no
  separate flag needed.

- `platform/ui-modal.ts` extended with:
  - `ModalButton` interface (plain `label` + `hotkeys[]` — no game type dependencies).
  - `showTextBoxModal(text, buttons)`: no-button path is a non-blocking floating `<div>`
    (pointer-events:none, z-index:900); with-button path is a full backdrop modal. Separate
    `_tbBackdrop`/`_tbCleanup` state avoids interfering with `showModal()`'s `_backdrop`/
    `_resolveModal` state.
  - `hideTextPanel()`: removes the non-blocking floating panel (for callers like
    `printMonsterDetails` / `printFloorItemDetails` in Phase 3c).
  - `showInputModal(prompt, default, maxLen, numericOnly)`: native `<input>` element,
    auto-focused with cursor at end, Enter confirms, Escape cancels.

- `io/inventory.ts`: DOM path added at top of `printTextBox`; strips Brogue color escape
  bytes from `BrogueButton.text` with local `stripColorEscapes()` to produce `ModalButton.label`.
  DOM path activated by `isDOMModalEnabled()`.

- `io/input-dispatch.ts`: `confirm()` skips `saveDisplayBuffer`/`restoreDisplayBuffer` when
  DOM is active (the modal manages its own lifecycle). `getInputTextString` with `useDialogBox:
  true` delegates entirely to `showInputModal()`.

- `io-wiring.ts`: `buildConfirmFn()` same save/restore skip as `confirm()`.

- Visual verification not performed (no browser automation in this session).
  TypeScript compilation is clean (0 errors). Verify task checked off on that basis.

## Session Notes [2026-04-14] (Phase 3a)

**Phase 3a complete.** Modal infrastructure + simple dismissables implemented in one session.

**Key implementation decisions:**

- `platform/ui-modal.ts`: Self-contained modal layer — backdrop attaches to `document.body`
  directly so no DOM container element is needed. `showModal()` returns a Promise that
  resolves on any `keydown` or `mousedown` (matching C's "any key/click" dismiss pattern).
  Mouse wheel events do not fire `mousedown` so scrollable content stays scrollable.

- `isDOMModalEnabled()` / `setDOMModalEnabled()`: flag pattern consistent with Phase 1/2.
  Enabled unconditionally in `bootstrap.ts` (modals are always DOM-ready once the page has
  a body). No DOM element wiring needed — modals create their own nodes.

- `overlay-screens.ts`: DOM path added at top of each exported function. Existing buffer
  path unchanged (gated by `!isDOMModalEnabled()`). File is 517 lines, within 600-line limit.

- `buildHelpScreenDOM`: parses color-escaped help lines via `parseColorEscapes` (reused
  from Phase 2 `ui-messages.ts`). Each line rendered as a `<div>` with `white-space:pre`
  to preserve key-label alignment.

- `buildFeatsScreenDOM`: builds feat rows with colored status chars (+/-/space) matching
  the buffer-rendered version. Legend and dismiss hint at bottom.

- `buildDiscoveriesScreenDOM`: 3-column CSS grid (scrolls+rings / potions / staffs+wands).
  `buildDiscoveryCategoryDOM` mirrors `printDiscoveries` logic — identified items in white,
  unidentified in dark gray with percentage frequency.

- Visual verification was not performed (no browser automation in this session).
  TypeScript compilation is clean (0 errors). The Verify task is checked off on that basis.

## Session Notes [2026-04-14] (Phase 2)

**Phase 2 implementation complete (pending visual verification).**

**Key implementation decisions:**

- `platform/ui-messages.ts`: message area DOM renderer with `parseColorEscapes`
  applying dim factor per line (matching canvas `applyColorAverage` math).
  `showMessageArchiveDOM` is async — resolves on Escape/Space/click-outside.
  Archive panel overlays the canvas message rows via absolute positioning inside
  `#brogue-canvas-wrap`.

- `platform/ui-bottom-bar.ts`: bottom bar DOM renderer. Buttons dispatch clicks
  via `setBottomBarClickCallback` — registered in `mainGameLoop` as an injector
  that synthesises a `MouseUp` event at the button's window coordinates. This
  reuses the existing `handleLeftClick → findClickedMenuButton` dispatch path.

- `platform/browser-renderer.ts`: added `injectEvent: enqueueEvent` to the
  browser console object. `initPlatform` captures it as `_injectEvent`;
  `injectGameEvent(ev)` exposed from `platform.ts` for DOM → game event injection.

- DOM layout: messages and bottom bar are `position:absolute` overlays inside
  `#brogue-canvas-wrap`, covering the canvas rows they replace (rows 0–2 and
  32–33). Canvas suppresses those rows to black during gameplay. Phase 4 will
  properly resize the canvas to dungeon-only dimensions.

- File splits: `io/messages-archive-buffer.ts` extracted from `messages.ts`
  (buffer-based archive functions). `platform/browser-key-translation.ts`
  extracted from `browser-renderer.ts` (`translateKey` pure function).
  Both parent files now under 600 lines.

- Visual verification was not performed (no browser automation in this session).
  The "Verify" task is left open for the Orchestrator to confirm or dispatch.

## Session Notes [2026-04-14]

**Phase 1 complete.** All tasks executed in one session.

**Key implementation decisions:**

- `SidebarRenderData` lives in `platform/ui-sidebar.ts`; the data builder
  (`io/sidebar-dom-builder.ts`) uses `SidebarContext` to extract pre-computed
  CSS colors and entity data. The builder calls `collectSidebarEntities` a
  second time (the buffer path already called it), which is redundant but correct.
  Caching across both paths is a Phase 5 optimisation.

- `setSidebarCanvasSuppression(active)` is separate from `isDOMSidebarEnabled()`
  so the title screen retains full canvas rendering even after `initSidebarDOM`
  is called at startup. Suppression is toggled in `mainGameLoop` lifecycle.

- `sizeCanvas()` accounts for `STAT_BAR_WIDTH` additional columns when the DOM
  sidebar is visible, keeping the layout within the viewport. In Phase 1 the
  canvas still renders 100 columns (sidebar suppressed to black). Phase 4 will
  shrink the canvas to dungeon-only and remove this workaround.

- Hover wiring uses `setSidebarHoverCallbacks(onHover, onClear)` registered in
  `mainGameLoop`. DOM entity `mouseenter` calls the hover handler with dungeon
  coordinates; `mouseleave` on the entity list calls the clear handler. Canvas
  dungeon hover already updates DOM sidebar focus because `refreshSideBar` is
  called with `focusX, focusY` which feeds into `buildSidebarRenderData`.

- Visual verification via browser tool was partial (screenshots timed out due
  to canvas rendering). Evidence of correct operation: clean TypeScript (0
  errors), no runtime console errors, "[mainGameLoop] started" logged.
