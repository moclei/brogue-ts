# Sprite Assigner V2 — Plan

## Approach

Four phases, each independently committable:

1. **Foundation** *(complete)* — Vite + React app with feature parity to
   the current HTML tool. Same UI, same functionality, proper project
   structure.
2. **Backend + file writes** — Vite server middleware for reading/writing
   sprite assets directly to `rogue-ts/assets/tilesets/`.
3. **Autotile sheet authoring** — third assignment mode for autotile
   variant sheets (8×6 grids per connection group).
4. **Live game updates** — signal the game dev server on save; game-side
   HMR handler hot-swaps sprites without page reload.

---

## Phase 1: Foundation

### Project setup

New Vite + React project at `tools/sprite-assigner-v2/`:

```
tools/sprite-assigner-v2/
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── state/
│   │   └── assignments.ts      — assignment state (TileType/Glyph → source ref)
│   ├── components/
│   │   ├── SheetPanel.tsx       — left sidebar: tileset browser
│   │   ├── GridPanel.tsx        — center: sheet grid with zoom/selection
│   │   ├── EnumPanel.tsx        — right: TileType/DisplayGlyph list
│   │   ├── GridCanvas.tsx       — canvas rendering for the sheet grid
│   │   ├── SelectionBar.tsx     — bottom bar: selected tile info
│   │   └── ExportModal.tsx      — modal for export/import
│   └── data/
│       ├── tile-types.ts        — TILE_TYPES array, GLYPH_NAMES, GLYPH_CHARS
│       └── initial-assignments.ts — seed data (mirrors current INITIAL_TILETYPE)
└── tsconfig.json
```

### State management

Assignment state currently lives in localStorage. V2 keeps localStorage as
the working state but adds:
- Load from `sprite-manifest.json` on startup (if backend is available)
- Save to localStorage on every change (instant feedback)
- Explicit "Save to disk" action via backend API (Phase 2)

Use React context + useReducer for state. No external state library needed
at this scale.

### UI port

The current tool has three panels in a CSS grid. Port them as React
components with the same layout and styling. The dark monospace theme is
good — keep it.

Key interactions to preserve:
- Click sheet tile → select → click enum entry → assign
- Zoom controls (1x–8x)
- Assignment markers on the grid
- Filter/status dropdowns in enum panel
- Export Code / Export JSON / Import JSON / Reset
- Keyboard: Escape to clear selection

### Startup

Add a script to the root or tools-level package.json:
```json
"scripts": { "assigner": "vite --config tools/sprite-assigner-v2/vite.config.ts" }
```

Or just `cd tools/sprite-assigner-v2 && npm run dev`. Either way, one
command, opens in browser.

---

## Phase 2: Backend + File Writes

### Vite server middleware

Use Vite's `configureServer` plugin hook to add API endpoints on the dev
server. No separate Express process needed.

Endpoints:
- `GET /api/manifest` — read current `sprite-manifest.json` from disk
- `GET /api/assignments` — read current assignment state (manifest +
  autotile data)
- `POST /api/save` — receives assignment data, generates master sheet +
  manifest, writes to `rogue-ts/assets/tilesets/`
- `GET /api/sheets/:key` — proxy source sheet images from
  `rogue-ts/assets/tilesets/` (so the app doesn't need relative path
  gymnastics)

### Master sheet generation (server-side)

Move the generation logic from `tools/generate-master-spritesheet.mjs`
into a server-side module that the `POST /api/save` endpoint calls. Uses
sharp (already a devDependency). The browser-side "Export Master Sheet"
button becomes "Save" → hits the API → files are written to disk.

### UI changes

- "Export Master Sheet" button → "Save to Disk" (calls `POST /api/save`)
- Toast notification: "Saved master-spritesheet.png + sprite-manifest.json"
- "Export Code" and "Export JSON" remain (useful for inspection)
- On startup, load assignments from disk manifest if available, falling
  back to localStorage

---

## Phase 3: Autotile Sheet Authoring

### Concept

Autotile sheets are 8×6 grids (48 cells, 47 used) of 16×16 sprites. Each
connection group (WALL, etc.) has one sheet. The user assigns source
sprites to variant slots the same way they assign sprites to TileTypes:
select a tile from a source sheet, click a variant slot.

### UI

The right panel gains a third tab: **TileType | DisplayGlyph | Autotile**.

Autotile mode shows:
- A dropdown to select the connection group (WALL, future groups)
- A visual 8×6 grid of variant slots (numbered 0–46)
- Each slot shows its assigned sprite (or empty placeholder)
- Click a slot to assign the currently selected source tile
- A reference diagram showing which bitmask each variant represents
  (corner/edge/center connectivity)

### Export

`POST /api/save` generates autotile sheets alongside the master sheet:
- For each connection group with assignments, compose an 8×6 spritesheet
- Write to `rogue-ts/assets/tilesets/autotile/<group>-autotile.png`
- Update the autotile manifest (new file or extension of
  `sprite-manifest.json`)

### Data model extension

Add to assignment state:
```typescript
interface AutotileAssignment {
  group: string;           // e.g. "WALL"
  variants: (SourceRef | null)[];  // 47 slots
}
```

---

## Phase 4: Live Game Updates

### Mechanism

When the assigner saves files to disk, Vite's built-in file watcher in the
game dev server detects the change. The `?url` import of
`master-spritesheet.png` in `tileset-loader.ts` gets invalidated.

Two approaches, in order of preference:

**(A) Vite HMR (clean):**
- Add a small Vite plugin to the game's `vite.config.ts` that watches
  `assets/tilesets/master-spritesheet.png` and sends a custom HMR event
- `tileset-loader.ts` registers an HMR accept handler that re-fetches the
  image, updates the tiles Map, and signals the renderer to rebuild bitmaps
- `SpriteRenderer` exposes a `reloadTiles(tiles)` method that rebuilds the
  ImageBitmap cache and triggers a full re-render

**(B) WebSocket reload (simple):**
- Assigner backend sends a WebSocket message to the game page after save
- Game page calls `location.reload()`
- No game code changes needed, but loses game state on reload

Recommendation: start with (B) for quick feedback, then upgrade to (A)
when the workflow is proven.

### Cross-server communication

The assigner runs on port 5174 (or similar), the game on 5173. For
approach (B), the assigner's save endpoint could ping the game's Vite
server via its WebSocket. Alternatively, both tools share a tiny signaling
channel (file-based or a shared WebSocket server).

For approach (A), no cross-server communication is needed — Vite's own
file watcher handles everything once the files are written to disk.

---

## Open Questions

- **React vs Preact vs vanilla:** *Resolved: React.* It's a dev tool,
  bundle size doesn't matter, and React ecosystem provides the best DX.
- **Shared WebSocket vs file watcher for live updates:** File watcher
  (approach A) is simpler and doesn't require cross-server coordination.
  But it requires game-side HMR handlers which touch more files. Decision
  deferred to Phase 4.
- **Autotile variant reference diagram:** Should the UI show which
  connectivity pattern each of the 47 variants represents? This would help
  artists understand what they're assigning. Could render bitmask diagrams
  as small SVGs or canvas drawings next to each slot.

---

## Session Notes — Phase 1

### Decisions made

- **Asset serving:** Added a Vite server middleware plugin in
  `vite.config.ts` that proxies tileset images via `/tilesets/` and serves
  the tileset manifest from the old tool directory. This avoids needing
  Vite `server.fs.allow` or symlinks. Phase 2's backend middleware will
  extend this pattern.
- **State architecture:** App-level UI state (selected tile, zoom, active
  sheet, image cache) uses React `useState` with a context provider.
  Assignment state (TileType/Glyph mappings) uses a separate
  `useReducer` + context. The two are decoupled deliberately — assignment
  state persists to localStorage, UI state is ephemeral.
- **Component split:** EnumEntry is its own component (with its own canvas
  for the thumbnail) to keep EnumPanel under the line limit and to enable
  per-entry memoization if performance becomes an issue.

### What's ready for Phase 2

The Phase 1 app has full feature parity with the original HTML tool:
- Sheet browsing, grid rendering with zoom/hover/selection
- TileType and DisplayGlyph assignment with thumbnails
- Export Code, Export JSON, Import JSON, Export Master Sheet (as downloads)
- Reset, Escape to clear selection, toast notifications
- localStorage persistence of assignments

Phase 2 adds the backend: Vite server middleware for direct disk writes,
replacing the download-and-copy workflow.

---

## Session Notes — Phase 2

### Decisions made

- **Server module split:** Generation logic ported from
  `tools/generate-master-spritesheet.mjs` into `src/server/generate.ts`
  (server-side, uses sharp). API routes in `src/server/api.ts` as a Vite
  plugin. The inline plugin from Phase 1's vite.config.ts was replaced —
  all middleware (legacy proxy routes + new API routes) now lives in api.ts.
- **assignments.json:** POST /api/save writes three files: the master PNG,
  sprite-manifest.json, AND assignments.json (the raw source-ref data).
  This enables GET /api/assignments for startup loading. The manifest only
  has grid positions (output), not source refs (input), so a separate file
  is needed to reconstruct the assignment state.
- **Startup loading:** AssignmentProvider fetches `/api/assignments` on
  mount. If the backend returns data, it overwrites the localStorage state
  via the existing `loadFromManifest` action. If the backend is unavailable
  (404, network error), localStorage state is kept. This allows standalone
  use without a backend.
- **sharp as devDependency:** Added directly to sprite-assigner-v2's
  package.json rather than the createRequire hack used in the mjs script.

### What's ready for Phase 3

Phase 2 is complete. The tool now:
- Serves API endpoints on the Vite dev server (no separate backend)
- "Save to Disk" writes master-spritesheet.png + sprite-manifest.json +
  assignments.json directly to rogue-ts/assets/tilesets/
- Loads assignments from disk on startup (falls back to localStorage)
- Export Code, Export JSON, Import JSON still available as secondary actions

Phase 3 adds autotile sheet authoring: a third assignment mode for the
47-variant autotile sheets per connection group.

---

## Session Notes — Phase 3

### Decisions made

- **Autotile data model:** Added `autotile: Record<string, AutotileVariants>`
  to `Assignments`, where `AutotileVariants = (SpriteRef | null)[]` (47
  entries per group). Simpler than a Map — serializes naturally to JSON
  for localStorage and the save API.
- **Connection groups data module:** Created
  `src/data/autotile-groups.ts` — copies the 7 group names and 47
  canonical masks from the game's `autotile.ts`. This is a deliberate
  duplication rather than an import to keep the tool self-contained.
  The group list and mask values rarely change.
- **Variant reference overlay:** Rather than a separate overlay panel,
  empty variant slots render mini 3×3 connectivity diagrams directly
  using canvas drawing. Blue=self, green=connected neighbor,
  gray=not connected. When a sprite is assigned, the diagram is
  replaced by the sprite thumbnail. This keeps the UI compact.
- **Right-click to unassign:** In the autotile grid, right-click on an
  assigned slot unassigns it. This avoids cluttering the compact grid
  with × buttons on every cell.
- **Hooks ordering fix:** Initial implementation had an early return in
  `EnumPanel` for the autotile tab that violated React's rules of hooks
  (the `useMemo` was only called for non-autotile tabs). Fixed by
  moving the early return after all hooks, with the `useMemo` returning
  an empty array when `activeTab === "autotile"`.

### New files

- `src/data/autotile-groups.ts` — connection group names, variant count,
  canonical masks, `getVariantInfo()`, `createEmptyVariants()`
- `src/components/AutotilePanel.tsx` — autotile tab UI: group dropdown,
  8×6 variant grid with sprite thumbnails and connectivity diagrams

### What's ready for Phase 4

Phase 3 is complete. The tool now supports all three assignment modes:
TileType, DisplayGlyph, and Autotile. POST /api/save generates autotile
sheet PNGs alongside the master sheet.

Phase 4 adds live game updates: Vite HMR wiring so the game hot-reloads
sprites when the assigner saves new assets to disk.
