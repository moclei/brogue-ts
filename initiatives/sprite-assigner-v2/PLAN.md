# Sprite Assigner V2 — Plan

## Approach

Four phases, each independently committable:

1. **Foundation** — Vite + React app with feature parity to the current
   HTML tool. Same UI, same functionality, proper project structure.
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

- **React vs Preact vs vanilla:** React is the default choice for
  familiarity. Preact would halve the bundle size but this is a dev tool,
  so bundle size doesn't matter. Vanilla + lit-html would avoid a
  framework entirely. Leaning React for ecosystem and component reuse.
- **Shared WebSocket vs file watcher for live updates:** File watcher
  (approach A) is simpler and doesn't require cross-server coordination.
  But it requires game-side HMR handlers which touch more files. Decision
  deferred to Phase 4.
- **Autotile variant reference diagram:** Should the UI show which
  connectivity pattern each of the 47 variants represents? This would help
  artists understand what they're assigning. Could render bitmask diagrams
  as small SVGs or canvas drawings next to each slot.
