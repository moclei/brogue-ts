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
- `io/inventory-display.ts` — `displayInventory` (~350 lines, most
  complex overlay)
- `io/inventory.ts` — `printTextBox`, `rectangularShading` (~130 lines)
- `io/overlay-screens.ts` — `printHelpScreen`, `displayFeatsScreen`,
  `printDiscoveriesScreen` (~190 lines)
- `io/effects-alerts.ts` — `flashTemporaryAlert`,
  `displayCenteredAlert` (~120 lines)

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

### Inventory Modal

`displayInventory` is the most complex overlay — it builds a button
array, renders items with magic-glyph symbols, handles keyboard/mouse
input via `buttonInputLoop`, and supports drill-down to item details.

The DOM version becomes an HTML modal with:
- Item list as styled `<button>` elements
- Keyboard navigation (up/down/letter keys)
- Click handling mapped to the same action dispatch
- `buttonInputLoop` replaced with an async event listener that resolves
  with the selected item

This is the highest-risk extraction and should be tested carefully.

### Interaction with `waitForEvent`

Some overlays block on input (inventory, help screen, text boxes).
Currently they call `buttonInputLoop` or similar, which polls the event
queue. The DOM version needs to intercept input events on the modal
elements and resolve the same async promise. The existing `waitForEvent`
mechanism should still work — DOM event handlers call `enqueueEvent`
just as the canvas handlers do.

---

## Open Questions

- **Message area positioning:** Should messages appear above or below
  the dungeon canvas? Currently they're rows 0–2 (above the dungeon).
  Keeping them above seems natural, but below could work for a more
  immersive feel. Default to above (matching current layout).
- **Sidebar hover → dungeon highlight:** Currently, hovering a sidebar
  entity highlights the corresponding dungeon cell (and vice versa).
  With the sidebar as DOM, we need mouse events on sidebar DOM elements
  to trigger dungeon cell highlighting on the canvas. This should work
  via the existing `sidebarLocationList` mapping.
- **Flavor text line:** Currently on row `ROWS - 2`, this shows
  contextual descriptions when hovering dungeon cells. Should it be
  part of the bottom bar (Phase 2) or its own element? Lean toward
  bottom bar.
