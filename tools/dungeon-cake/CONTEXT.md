# Dungeon Cake

Standalone dev tool for evaluating sprites in the context of real dungeon layouts. Generates levels on demand, renders sprites at proper scale with the full layer compositing pipeline, and provides debug controls in a non-overlapping UI.

**Start:** `cd tools/dungeon-cake && npm run dev` (port 5175+)

---

## What It Does

The game's F2 debug panel renders on the same canvas as the dungeon, making sprites too small to evaluate, causing panel occlusion when zoomed, and requiring gameplay to reach interesting terrain. Dungeon Cake solves all three:

1. **Scale** — renders the 79x29 dungeon grid at integer zoom (1x–4x) with `image-rendering: pixelated`. No bilinear blur.
2. **Non-overlapping UI** — debug controls are React components in the page layout, not overlaid on the canvas.
3. **On-demand generation** — controllable depth (1–40) and seed produce repeatable layouts instantly. No gameplay needed.

---

## Features

### Generation controls (toolbar)

- **Depth (1–40)** — controls dungeon profile, machine types, lava/water frequency
- **Seed** — deterministic RNG via `seedRandomGenerator(BigInt(seed))`
- **Generate / Re-roll** — run `digDungeon`, re-roll increments seed by 1
- **Zoom (1x–4x)** — integer scaling, default 2x

### Dungeon canvas (center)

- 79x29 grid rendered with actual sprites via `SpriteRenderer.drawCellLayers()`
- Fed by `getCellSpriteData()` through a terrain-only `CellQueryContext`
- Scrollable when canvas exceeds viewport

### Layer debug panel (bottom, resizable)

11 `RenderLayer` columns (TERRAIN, LIQUID, SURFACE, ITEM, ENTITY, GAS, FIRE, VISIBILITY, STATUS, BOLT, UI), each with:

- **Visibility checkbox** — toggle layer on/off
- **Tint override** — enable checkbox + color picker + alpha slider
- **Alpha slider (0.0–1.0)** — override `globalAlpha` for the layer
- **Blend mode dropdown** — none, multiply, source-over, screen, overlay, color-dodge, color-burn

All controls sync to the `spriteDebug` singleton via React `useReducer` → singleton bridge.

### Global controls (below layer grid)

- **Lighting toggle** — on = call `updateLighting()` (glowing tiles + miner's light), off = all cells fully lit
- **Background color override** — replace the dark background with a custom color
- **Reset All** — restore all overrides to defaults

### Fog-of-war toggle (toolbar dropdown)

Cycles visibility state on all cells:

- All Visible (default) — `DISCOVERED | VISIBLE`
- Remembered — `DISCOVERED` only
- Clairvoyant / Telepathic / Magic Mapped — corresponding `TileFlag`
- Omniscience — sets `rogue.playbackOmniscience = true`

### Resizable panel

Drag divider between canvas and debug panel. Height persisted in localStorage.

---

## Architecture

```
src/
├── main.tsx, App.tsx              — entry point, toolbar / canvas / panel layout
├── styles.css                     — dark monospace theme
├── state/
│   ├── dungeon-state.ts           — React contexts for pmap/depth/seed + actions
│   └── debug-state.ts             — useReducer for layer overrides, syncs → spriteDebug singleton
├── generation/
│   ├── generate-level.ts          — constructs ArchitectContext + MachineContext, calls digDungeon
│   ├── query-context.ts           — CellQueryContext factory, fog mode, lighting integration
│   └── stubs.ts                   — no-op ItemOps/MonsterOps, PlayerCharacter/Creature stubs
├── rendering/
│   ├── dungeon-canvas.tsx         — canvas component, iterates cells at zoom
│   └── cell-renderer.ts           — getCellSpriteData → SpriteRenderer.drawCellLayers bridge
├── shared/
│   └── tileset-bridge.ts          — loads tileset images + sprite maps, constructs renderers
└── components/
    ├── Toolbar.tsx                 — depth, seed, generate, re-roll, zoom, fog dropdown
    ├── DebugPanel.tsx              — resizable bottom panel with layer grid + children slot
    ├── LayerColumn.tsx             — per-layer visibility/tint/alpha/blend controls
    └── GlobalControls.tsx          — lighting toggle, bg color override, Reset All
```

### Three layers

1. **Generation** — constructs `ArchitectContext` with catalog imports and callback wiring, plus `MachineContext` with no-op `ItemOps`/`MonsterOps` stubs. Calls `seedRandomGenerator()` then `digDungeon()`. Produces terrain-complete levels (rooms, corridors, lakes, chasms, machines) without items or creatures.

2. **Query** — constructs `CellQueryContext` with the generated `pmap`, initialized `tmap` (visibility flags per fog mode), and stubbed `rogue`/`player`. Optionally calls `updateLighting()` when the lighting toggle is on. Feeds `getCellSpriteData()`.

3. **Rendering** — constructs `TextRenderer` + `SpriteRenderer` with tileset images from `rogue-ts/assets/tilesets/`. Calls `drawCellLayers()` per cell at integer zoom. Debug overrides flow through the `spriteDebug` singleton.

### Debug state bridge

The game's `spriteDebug` singleton is read by `SpriteRenderer` at draw time. The tool manages the same state shape in React (`useReducer`). On every state change, the reducer writes updated values to the singleton, then increments a `redrawCounter` that the canvas component depends on.

---

## How It Connects to the Game

Dungeon Cake imports game modules directly via Vite path aliases (`@game/` → `../../rogue-ts/src/`). No iframe, no worker, no shared library. The game's DI architecture makes this viable:

- `ArchitectContext` + `MachineContext` — generation pipeline, free of `core.ts` imports
- `CellQueryContext` — rendering pipeline, all dependencies provided explicitly
- `spriteDebug` singleton — the tool writes to it, `SpriteRenderer` reads it at draw time

**Files read from `rogue-ts/assets/tilesets/`:**
- `master-spritesheet.png` — packed sprite sheet (written by sprite assigner)
- `sprite-manifest.json` — enum → sprite coordinate maps
- `autotile/*.png` — per-connection-group variant sheets

### Relationship to other tools

| Tool | Role |
|---|---|
| **Sprite Assigner V2** | Assigns *which* sprite maps to *which* enum. Writes master sheet + manifest. |
| **Dungeon Cake** | Shows *how* those sprites look rendered through the full layer pipeline. |
| **F2 Debug Panel** (in-game) | Same controls as Dungeon Cake but overlaid on the game canvas. Will be removed once Dungeon Cake reaches full feature parity. |

---

## Roadmap (Post-V1)

These are not yet planned as initiatives. In rough priority order:

| Feature | Description |
|---|---|
| **Cell inspection** | Click a cell to see per-layer breakdown: active layers, tileType, autotile bitmask/variant/group, tint values, 3x3 neighbor grid. |
| **Deep-dive Canvas2D controls** | Per-layer CSS filter, shadow (blur/color/offset), image smoothing, flip, rotation, scale. Port from the F2 deep-dive panel (`sprite-debug-detail.ts`). |
| **Tileset hot-reload** | Watch `rogue-ts/assets/tilesets/` for changes. Sprite assigner saves → Dungeon Cake re-fetches images, rebuilds sprite maps, redraws. |
| **F2 panel removal** | Remove `sprite-debug.ts` and `sprite-debug-detail.ts` from the game. Blocked on cell inspection + deep-dive controls. |
| **colorDances animation** | `requestAnimationFrame` loop for shimmer effects via `bakeTerrainColors`. |
| **Creature & item placement** | Expand stubs with real `MonsterOps`/`ItemOps` to render ENTITY and ITEM layers. |
| **Minimap** | Small overview showing viewport position when zoomed in. |
| **Pre-baked showcase seeds** | Curated depth+seed pairs for visually interesting layouts. |
| **Live sprite assigner link** | WebSocket or shared-state — assigner changes appear without saving to disk. |

---

## Exploration & Design Docs

- `docs/pixel-art/debug/layer-debug-tool.md` — original exploration doc with dependency analysis, stub strategies, design space evaluation
- `initiatives/dungeon-cake/` — BRIEF/PLAN/TASKS for the v1 build (Phases 1a, 1b, 2 — all complete)
