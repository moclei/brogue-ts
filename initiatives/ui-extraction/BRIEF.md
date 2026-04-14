# UI Extraction

## Intent

Move the game's UI elements — sidebar, message area, bottom bar, and
overlay menus — out of the canvas-based `ScreenDisplayBuffer` and into
HTML/DOM elements. The canvas becomes exclusively a dungeon renderer,
which unblocks the dungeon camera initiative and makes UI text
resolution-independent, accessible, and responsive at any viewport size.

## Goals

- The sidebar (player stats, entity list, depth display) renders as
  styled HTML, always crisp and readable regardless of canvas zoom.
- The message area renders as HTML text, scrollable and selectable.
- Overlay screens (inventory, help, discoveries, feats, monster/item
  detail popups) render as HTML modals or panels, not drawn into the
  canvas buffer.
- The bottom bar (menu buttons, flavor text) renders as HTML.
- During gameplay, the canvas draws only the 79×29 dungeon viewport.
- The main menu (title screen, flame animation) continues to use the
  canvas — it does not need extraction since the camera is not active
  during menus.
- Game logic and the `ScreenDisplayBuffer` continue to work as-is for
  any code paths that haven't been extracted yet. Extraction is
  incremental — partially extracted states must be playable.

## Scope

What's in:
- HTML/CSS layout wrapping the canvas with sidebar, message, and bottom
  bar regions
- DOM-based sidebar rendering (stats, entity list, progress bars)
- DOM-based message display (including message archive scroll)
- DOM-based bottom bar (game menu buttons, flavor line)
- HTML modal/panel overlays for: inventory, help screen, feats,
  discoveries, text boxes (monster/item detail), confirm dialogs,
  system/escape menu, text entry dialogs
- Bridging layer: functions that currently write to `displayBuffer` for
  UI regions get replaced with functions that update DOM elements
- Styling that matches the current dark monospace aesthetic

What's out:
- Changes to game logic or the dungeon rendering pipeline
- The dungeon camera system (separate initiative, depends on this one)
- Main menu / title screen extraction (stays on canvas)
- Pre-game menus (character select, file picker, game stats) — stay
  on canvas; they run before gameplay starts
- Wizard mode / machine debug overlays — development tools, stay
  buffer-based
- Redesigning the UI layout or information architecture — this is a
  faithful extraction, not a redesign
- Mobile/touch support (future initiative)

## Constraints

- **600 lines max per file.** Split components into focused modules.
- **Incremental extraction.** Each phase must leave the game playable.
  UI regions not yet extracted continue rendering via the canvas buffer.
- **Buffer-write fallback.** Keep existing buffer-write code paths
  gated behind a flag rather than deleting them. This preserves the
  option to ship the base game with terminal-style rendering and avoids
  hard-to-reverse deletions during incremental extraction.
- **No game logic changes.** The sidebar data (what entities to show,
  their stats, health percentages) is still computed by the existing
  functions. Only the rendering output target changes.
- **Visual parity, not pixel-identical.** The extracted HTML UI should
  convey the same information and match the dark monospace aesthetic,
  but DOM modals will naturally look different from buffer-drawn panels
  (no distance-based opacity falloff, different text rendering). This
  is expected and acceptable.
