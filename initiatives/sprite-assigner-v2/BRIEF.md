# Sprite Assigner V2

## Intent

Rebuild the sprite-assigner from a standalone HTML file into a proper local
dev tool with a backend. The current tool requires manual file downloads,
jank startup (`npx serve .` + navigate to an HTML path), and has no
connection to the running game. V2 makes sprite authoring a first-class
development workflow: one command to start, direct file writes, live preview
in the game, and autotile sheet authoring alongside base sprite assignment.

## Goals

- **One-command startup.** `npm run assigner` (or similar) launches a
  Vite-based React app on a local port. No manual URL navigation.
- **Direct file writes.** Clicking "Save" overwrites
  `master-spritesheet.png`, `sprite-manifest.json`, and autotile sheets
  directly in `rogue-ts/assets/tilesets/`. No download-and-copy workflow.
- **Live game updates.** When the assigner saves new sprite assets, the
  running game dev server detects the change and hot-reloads sprites
  without a full page refresh.
- **Autotile sheet authoring.** A third mode (alongside TileType and
  DisplayGlyph) lets the user assign source sprites into the 47 variant
  slots of an autotile sheet per connection group — same pick-and-assign
  flow, different output grid (8×6 per group).

## Scope

What's in:
- Vite + React app in `tools/sprite-assigner-v2/` with its own
  `package.json`
- Vite server middleware for reading/writing sprite assets to disk
- Port of all existing sprite-assigner functionality (sheet browser, grid
  view, TileType/DisplayGlyph assignment, zoom, filter, export/import)
- Autotile sheet authoring UI and export
- Live-reload signaling to the game dev server
- Game-side HMR handler for hot-swapping the master spritesheet and
  rebuilding ImageBitmap caches

What's out:
- Changes to game logic or the ASCII renderer
- New sprite art or asset creation
- Animation authoring (separate initiative)
- Deployment/hosting of the tool — it's dev-only, localhost
- Removing the old sprite-assigner HTML file (keep as reference until V2
  reaches parity)

## Constraints

- **600 lines max per file.** Split React components and backend handlers
  into focused modules.
- **Game code untouched except for HMR wiring.** The sprite pipeline
  (renderer, appearance, render-layers) should not change. Only the asset
  loading path gains HMR accept handlers.
- **Existing tests must pass.** The manifest-driven glyph-sprite-map.ts
  from Phase 4 is the foundation — V2 writes the same manifest format.
- **Autotile sheets stay separate.** The master spritesheet covers base
  sprites. Autotile variant sheets remain per-connection-group PNGs
  (8×6 grid, 47 variants each). V2 generates these alongside the master
  sheet, not merged into it.
