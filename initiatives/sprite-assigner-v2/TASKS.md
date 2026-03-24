# Sprite Assigner V2 — Tasks

## Phase 1: Foundation

- [x] Set up Vite + React project in `tools/sprite-assigner-v2/`:
  `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`,
  `src/main.tsx`. Install react, react-dom, vite, @vitejs/plugin-react,
  typescript. Verify `npm run dev` starts and serves a blank page.
- [x] Create data modules:
  - `src/data/tile-types.ts` — TILE_TYPES, DISPLAY_GLYPHS, GLYPH_CHARS
    arrays (extracted from current index.html)
  - `src/data/initial-assignments.ts` — INITIAL_TILETYPE, INITIAL_GLYPH
    seed data
  - `src/data/sheet-manifest.ts` — tileset manifest type + loader
    (replaces fetch of `tileset-manifest.json`)
- [x] Create assignment state module (`src/state/assignments.ts`):
  - React context + useReducer for TileType/Glyph assignment maps
  - Actions: assign, unassign, reset, importJSON, loadFromManifest
  - localStorage persistence (read on init, write on every change)
  - Stats computation (assigned/total counts)
- [x] Build SheetPanel component (left sidebar):
  - Reads tileset manifest, renders collapsible groups with sheet buttons
  - Clicking a sheet loads its image and updates the grid
- [x] Build GridPanel + GridCanvas components (center):
  - Canvas rendering of the current sheet at zoom level
  - Grid lines, assignment markers, hover highlight, selection highlight
  - Zoom controls (1x–8x)
  - Mouse click → select tile, mousemove → hover
- [x] Build SelectionBar component (bottom of grid panel):
  - Shows selected tile preview (48×48 canvas), coordinates, used-by list
  - Clear button (Escape key binding)
- [x] Build EnumPanel component (right sidebar):
  - Tab switching: TileType | DisplayGlyph
  - Filter input + status dropdown (all/assigned/unassigned)
  - Scrollable list of enum entries with sprite thumbnails
  - Click entry → assign selected tile; click thumbnail → jump to sprite
  - Unassign button per entry
- [x] Build ExportModal component:
  - Export Code (TypeScript), Export JSON, Import JSON
  - Master sheet export (PNG + manifest download links)
  - Copy-to-clipboard support
- [x] Wire App.tsx: three-panel CSS grid layout, keyboard handler (Escape),
  toast notifications. Verify full feature parity with current HTML tool.
- [x] Add npm script for easy startup (`npm run dev` in the tool directory)
- [x] Commit Phase 1 with descriptive message
- [x] Update TASKS.md and PLAN.md to reflect current state; generate
  hand-off prompt for a new session to continue with Phase 2

# --- handoff point ---

## Phase 2: Backend + File Writes

- [x] Add Vite server middleware plugin (`src/server/api.ts`):
  - `GET /api/manifest` — reads `sprite-manifest.json` from
    `rogue-ts/assets/tilesets/`
  - `GET /api/sheets/:key` — proxies source sheet PNGs
  - `POST /api/save` — receives assignments, generates master sheet +
    manifest, writes to disk
- [x] Move master sheet generation logic from
  `tools/generate-master-spritesheet.mjs` into a server-side module
  (`src/server/generate.ts`). Reuse sharp for image compositing.
- [x] Update UI: replace "Export Master Sheet" with "Save to Disk" button.
  Calls `POST /api/save`, shows success/error toast. Keep Export Code and
  Export JSON as secondary actions.
- [x] On startup, attempt to load assignments from `GET /api/assignments`.
  Fall back to localStorage if backend unavailable (allows standalone use).
- [x] Verify end-to-end: assign a sprite → Save to Disk → confirm
  `master-spritesheet.png`, `sprite-manifest.json`, and `assignments.json`
  updated on disk. Also writes `assignments.json` for startup reload.
  GET /api/assignments returns saved data. Startup loads from disk when
  available, falls back to localStorage.
- [x] Commit Phase 2 with descriptive message
  Two commits: 6d6ab24 (middleware + generation) and 593193f (UI + startup)
- [x] Update TASKS.md and PLAN.md to reflect current state

# --- handoff point ---

## Phase 3: Autotile Sheet Authoring

- [ ] Extend assignment state with autotile data:
  - Per-group variant assignments: `Map<string, (SourceRef | null)[]>`
  - Actions: assignVariant, unassignVariant, resetGroup
  - Persist alongside TileType/Glyph assignments in localStorage
- [ ] Add Autotile tab to EnumPanel:
  - Connection group dropdown (WALL, future groups)
  - Visual 8×6 grid showing variant slots 0–46 with sprite thumbnails
  - Click a slot → assign currently selected source tile
  - Unassign button per slot
- [ ] Add variant reference overlay: small connectivity diagram per slot
  showing which edges/corners are connected for that variant index
- [ ] Extend `POST /api/save` to generate autotile sheets:
  - Compose 8×6 spritesheet per group from variant assignments
  - Write to `rogue-ts/assets/tilesets/autotile/<group>-autotile.png`
- [ ] Verify: assign 47 wall variants → Save → confirm
  `wall-autotile.png` updated → game renders correct autotile variants
- [ ] Commit Phase 3 with descriptive message
- [ ] Update TASKS.md and PLAN.md to reflect current state; generate
  hand-off prompt for a new session to continue with Phase 4

# --- handoff point ---

## Phase 4: Live Game Updates

- [ ] Add Vite plugin to game's `vite.config.ts` that watches
  `assets/tilesets/master-spritesheet.png` and
  `assets/tilesets/autotile/*.png` for changes, sends custom HMR event
- [ ] Add HMR accept handler in `tileset-loader.ts`: on spritesheet
  change, re-fetch the image, update the tiles Map
- [ ] Add `reloadTiles()` method to SpriteRenderer: clears ImageBitmap
  cache, re-runs `precreateBitmaps()`, triggers full re-render
- [ ] Verify end-to-end: assigner saves → game updates sprites in-place
  without page reload, game state preserved
- [ ] Fallback: if HMR wiring proves too complex, implement WebSocket
  approach (assigner signals game page to `location.reload()`)
- [ ] Commit Phase 4 with descriptive message
- [ ] Update TASKS.md and PLAN.md to reflect initiative completion
