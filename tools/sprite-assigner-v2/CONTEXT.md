# Sprite Assigner V2

Local dev tool for managing the game's sprite pipeline. Runs as a Vite + React app with server-side middleware — no separate backend process.

**Start:** `npm run dev` (opens on port 5174)

---

## What It Does

The assigner connects source sprite sheets (DawnLike, Demonic Dungeon, etc.) to the game's rendering system. It outputs three things:

1. **`master-spritesheet.png`** — a packed PNG containing every assigned TileType and DisplayGlyph sprite in a fixed grid layout.
2. **`sprite-manifest.json`** — maps enum names to grid coordinates in the master sheet. The game's `glyph-sprite-map.ts` reads this at startup.
3. **Autotile sheets** — per-connection-group PNGs (e.g. `wall-autotile.png`) with 47 variant sprites in an 8x6 grid.

All output files are written directly to `rogue-ts/assets/tilesets/`. When the game's Vite dev server is running, it detects the file changes and hot-reloads sprites without a page refresh.

---

## Features

### Three assignment modes (right panel tabs)

- **TileType** — assign a source sprite to each of the ~215 TileType enum values (WALL, FLOOR, DOOR, etc.)
- **DisplayGlyph** — assign a source sprite to each of the ~131 DisplayGlyph enum values (creatures, items, effects)
- **Autotile** — assign sprites to the 47 connectivity variants per connection group (WALL, WATER, LAVA, etc.)

### Sheet management (left panel)

- Browse registered sprite sheets organized by tileset group (DawnLike, Demonic Dungeon, etc.)
- **Add sheets:** `+` button on each group opens a dialog to pick a PNG, set a key and category, and upload it into `rogue-ts/assets/tilesets/`
- **Add groups:** "+ New Group" at the bottom creates a new tileset group
- **Remove:** `x` on hover removes sheets or groups from the registry

### Grid view (center panel)

- Zoomable canvas rendering of the selected source sheet (1x–8x)
- Assignment markers show which tiles are already used
- Click to select a tile, then click an enum entry or autotile slot to assign it

### Export & save

- **Save to Disk** — generates master sheet + manifest + autotile sheets, writes to `rogue-ts/assets/tilesets/`
- **Export Code** — TypeScript source for the assignment maps
- **Export/Import JSON** — portable assignment data

### Live game updates (HMR)

When you click Save, the game's Vite dev server detects the file changes via a custom `tilesetHmrPlugin`. It sends a `tileset-update` HMR event to the browser, which triggers `bootstrap.ts` to re-fetch all images and the manifest, rebuild sprite maps, and redraw — without losing game state.

---

## Architecture

```
src/
├── main.tsx, App.tsx             — entry point, three-panel layout
├── styles.css                    — dark monospace theme
├── data/
│   ├── tile-types.ts             — TILE_TYPES, DISPLAY_GLYPHS arrays
│   ├── initial-assignments.ts    — seed data for first-time use
│   ├── sheet-manifest.ts         — manifest types, load/save/upload helpers
│   └── autotile-groups.ts        — 7 connection groups, 47 canonical masks
├── state/
│   ├── app-state.ts              — UI state context (selected tile, zoom, etc.)
│   └── assignments.ts            — assignment state (useReducer + context + localStorage)
├── server/
│   ├── api.ts                    — Vite middleware plugin: API routes + asset proxy
│   └── generate.ts               — sharp-based master sheet + autotile sheet compositing
└── components/
    ├── SheetPanel.tsx             — left: sheet browser + management controls
    ├── SheetManager.tsx           — add-sheet and add-group dialogs
    ├── GridPanel.tsx              — center: toolbar + scrollable grid container
    ├── GridCanvas.tsx             — canvas rendering of source sheet with overlays
    ├── SelectionBar.tsx           — selected tile preview + info
    ├── EnumPanel.tsx              — right: TileType/Glyph tabs with filter + list
    ├── EnumEntry.tsx              — single enum row with thumbnail canvas
    ├── AutotilePanel.tsx          — autotile tab: group dropdown + 8x6 variant grid
    └── ExportModal.tsx            — export/import/save actions
```

### State management

Two separate React contexts, deliberately decoupled:

- **AppState** (`app-state.ts`) — ephemeral UI state: selected tile, zoom level, active sheet, image cache, toast messages. Uses `useState`.
- **Assignments** (`assignments.ts`) — persistent data: TileType/Glyph assignment maps + autotile variant maps. Uses `useReducer` + localStorage. On startup, loads from `GET /api/assignments` (disk) if available, falls back to localStorage.

### Server middleware

The Vite dev server runs the API — no separate backend. `api.ts` is a Vite plugin that adds middleware routes:

| Route | Method | Purpose |
|---|---|---|
| `/api/manifest` | GET | Read `sprite-manifest.json` from disk |
| `/api/assignments` | GET | Read `assignments.json` (source refs) from disk |
| `/api/sheets/:key` | GET | Serve source sheet PNG by key |
| `/api/save` | POST | Generate master + autotile sheets, write all files |
| `/api/tileset-manifest` | GET | Read the sheet registry |
| `/api/tileset-manifest` | PUT | Update the sheet registry |
| `/api/upload-sheet` | POST | Upload a PNG + add to registry |
| `/tilesets/<path>` | GET | Asset proxy for source PNGs |

### Key file: `tileset-manifest.json`

Lives in this tool's root directory. Registers all available source sheets grouped by tileset. This is the single source of truth — the sheet management UI reads and writes it, and the server uses it to resolve sheet keys to file paths during generation.

---

## How It Connects to the Game

The assigner writes files to `rogue-ts/assets/tilesets/`. The game reads them:

- `tileset-loader.ts` — imports `master-spritesheet.png` and autotile PNGs via Vite `?url`
- `glyph-sprite-map.ts` — imports `sprite-manifest.json` to build TileType/Glyph → SpriteRef maps
- `sprite-renderer.ts` — uses the maps to draw sprites with multiply tinting
- `autotile.ts` — connection group definitions and bitmask-to-variant reduction

The HMR bridge is in `rogue-ts/vite.config.ts` (`tilesetHmrPlugin`) and `bootstrap.ts` (event handler).
