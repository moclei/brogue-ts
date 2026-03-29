# Sprite Loading Consolidation — Plan

## Approach

The consolidation removes the three-way key translation between `tileset-loader.ts` (physical files), `glyph-sprite-map.ts` (group→sheet mapping), and `assignments.json` (variant coordinates). After the refactor, `assignments.json` is the only file the game reads for sprite configuration.

The key design change from the original plan: **the game natively understands both Wang Blob (7×7) and 8×6 grid autotile formats.** The artist's source PNG is the runtime asset — the sprite assigner no longer generates intermediate 8×6 sheets or rewrites coordinates. This eliminates the conversion step that caused the chasm coordinate/image mismatch bug and enables edit-reload iteration without touching the assigner.

### Current architecture (three sources of truth)

```
tileset-loader.ts          glyph-sprite-map.ts           assignments.json
─────────────────          ────────────────────           ────────────────
SHEET_URLS:                AUTOTILE_SHEETS:               autotile.CHASM[*]:
  ChasmAutotile →            CHASM → ChasmAutotile         sheet: "chasm-autotile"
  autotile/chasm.png       SHEET_NAME_MAP:                 x: 0, y: 0
                              "chasm-autotile" →            (47 per-variant coords)
                              "ChasmAutotile"
```

Data flows through two translation layers. The chasm bug: tileset-loader loaded the Wang Blob PNG but assignments.json had 8×6 grid coordinates (written by `rewriteAutotileForGame`). Phase 1 hotfixed this by pointing the import at the correct 8×6 grid sheet.

### Target architecture (single source of truth)

```
assignments.json
────────────────
sheets:
  master: "master-spritesheet.png"

autotile:
  WALL:  { sheet: "autotile/wall-autotile.png",       format: "grid" }
  FLOOR: { sheet: "autotile/floor-autotile.png",      format: "grid" }
  CHASM: { sheet: "raw-autotile/chasm-autotile-v3.png", format: "wang" }

tiletype:
  CARPET: { sheet: "mainlevbuild", x: 1, y: 3 }
  ...
```

The game reads `sheets` to load the master spritesheet, `autotile` to load per-group autotile sheets (using the format to resolve variant→coordinates), and `tiletype`/`glyph` for the assigner's source references. Sheet keys match group names directly — no translation maps.

### Autotile variant resolution

When the game needs variant N for connection group G:
1. Look up `autotile[G]` → `{ sheet, format }`
2. Load image using sheet path (keyed by group name in the image map)
3. Map variant index to grid coordinates based on format:
   - **"grid"** (8×6): `x = N % 8, y = floor(N / 8)` — existing `autotileVariants()`
   - **"wang"** (7×7): lookup from `buildVariantToWangBlob()` — existing `wangBlobVariants()`

Both code paths already exist and are tested. No new bitmask or layout logic needed.

## Technical Notes

### Image loading without static imports

Current tileset-loader uses Vite `?url` imports for content-hashed URLs in production builds. The refactored loader uses `new Image()` with paths constructed from the JSON. In dev mode these resolve to Vite's dev server. Production builds would need a separate asset-resolution step (out of scope).

The `tilesetHmrPlugin` watches `assets/tilesets/` at the filesystem level and fires `tileset-update` custom events. This is independent of Vite's module graph, so it works regardless of how images are loaded.

### Sprite assigner changes

**Removed:**
- `generateAutotileSheets()` in `generate.ts` — no more intermediate 8×6 sheet compositing
- `rewriteAutotileForGame()` in `api.ts` — no more coordinate rewriting
- Per-variant autotile assignment UI (the 8×6 grid of clickable slots)

**Added:**
- Per-group autotile assignment: each connection group gets a sheet path + format
- Save endpoint writes the new `autotile` format (object per group, not array of 47 variants)

**Unchanged:**
- Master spritesheet generation (tiletype + glyph compositing)
- `sprite-manifest.json` output
- Sheet management UI (left panel), TileType/Glyph assignment (right panel tabs)

### Backward compatibility

Phase 1 fixed the immediate bug without changing the schema. Phase 2 changes the `autotile` section from per-variant arrays to per-group objects — this is a breaking schema change. The assigner and game changes land in the same commit to avoid a mixed-format state.

### What `sprite-manifest.json` becomes

Currently `sprite-manifest.json` maps TileType/Glyph names to grid coordinates in the master sheet. After consolidation, `assignments.json` already contains tiletype/glyph source references — but these point to source sheets, not the master sheet. The manifest maps names to master sheet positions and is still needed by the game. No change to it in this initiative.

## Rejected Approaches

### Assigner always converts Wang Blob → 8×6 grid (original plan)
Rejected because it requires a round-trip through the sprite assigner for every art change. The user authors in Wang Blob format and wants edit-reload iteration without clicking Save in the assigner. Native Wang Blob support in the game eliminates this friction.

## Open Questions

(None currently — the `sprite-manifest.json` question is resolved: it stays.)
