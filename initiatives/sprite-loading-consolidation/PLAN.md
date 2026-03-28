# Sprite Loading Consolidation — Plan

## Approach

The consolidation removes the three-way key translation between `tileset-loader.ts` (physical files), `glyph-sprite-map.ts` (group→sheet mapping), and `assignments.json` (variant coordinates). After the refactor, `assignments.json` is the only file the game reads for sprite configuration.

### Current architecture (three sources of truth)

```
tileset-loader.ts          glyph-sprite-map.ts           assignments.json
─────────────────          ────────────────────           ────────────────
SHEET_URLS:                AUTOTILE_SHEETS:               autotile.CHASM[*]:
  ChasmAutotile →            CHASM → ChasmAutotileV3       sheet: "chasm-autotile"
  raw-autotile/v3.png      SHEET_NAME_MAP:                 x: 0, y: 0
                              "chasm-autotile" →
                              "ChasmAutotile"
```

Data flows through two translation layers. The chasm bug: tileset-loader loads the Wang Blob PNG (`raw-autotile/chasm-autotile-v3.png`) but assignments.json has 8×6 grid coordinates (written by the sprite assigner's `rewriteAutotileForGame`). Coordinates and image disagree.

### Target architecture (single source of truth)

```
assignments.json
────────────────
sheets:
  master: "master-spritesheet.png"
  wall-autotile: "autotile/wall-autotile.png"
  chasm-autotile: "autotile/chasm-autotile.png"

tiletype:
  CARPET: { sheet: "master", x: 1, y: 3 }

autotile:
  CHASM: [{ sheet: "chasm-autotile", x: 0, y: 0 }, ...]
```

The game reads `sheets` to know what images to load, and `autotile`/`tiletype`/`glyph` sections to know where sprites live within those images. Sheet keys match directly — no translation.

## Technical Notes

### Image loading without static imports

Current tileset-loader uses Vite `?url` imports for content-hashed URLs in production builds. The refactored loader uses `new Image()` with paths constructed from the JSON. In dev mode these resolve to Vite's dev server. Production builds would need a separate asset-resolution step (out of scope).

The `tilesetHmrPlugin` watches `assets/tilesets/` at the filesystem level and fires `tileset-update` custom events. This is independent of Vite's module graph, so it works regardless of how images are loaded.

### Sprite assigner output changes

`generate.ts` → `api.ts` save endpoint currently writes:
- `master-spritesheet.png` + `sprite-manifest.json`
- `autotile/*.png` (8×6 grid sheets)
- `assignments.json` (with `rewriteAutotileForGame` applied)

After the change, it also writes a `sheets` section into `assignments.json` listing every output file. The `tiletype` entries get their sheet key set to `"master"` (matching the sheets section key). No other output format changes.

### Backward compatibility

Phase 1 fixes the immediate bug without changing the schema. Phases 2–4 change the schema atomically — the assigner writes the new format and the game reads it. There's no mixed-format intermediate state because both changes land in the same commit.

### What `sprite-manifest.json` becomes

Currently `sprite-manifest.json` maps TileType/Glyph names to grid coordinates in the master sheet. After consolidation, `assignments.json` already contains this information in its `tiletype` and `glyph` sections — the manifest is redundant. It can be removed once the game reads coordinates from assignments.json directly.

## Open Questions

- Should `sprite-manifest.json` be removed entirely, or kept as a build artifact for external tools? Leaning toward removal since the assigner is the canonical tool.
