# Sprite Loading Consolidation

## Intent

Make `assignments.json` the single source of truth for all sprite configuration. Currently, sprite sheet metadata is scattered across three files (`tileset-loader.ts`, `glyph-sprite-map.ts`, `assignments.json`) with redundant key-translation maps that have already caused rendering bugs. The sprite assigner should be the sole writer of sprite config, and the game should blindly read whatever the JSON says.

Additionally, simplify the autotile workflow: the game natively understands both Wang Blob (7×7) and grid (8×6) sheet formats, so the artist's source PNG is loaded directly at runtime — no intermediate conversion step. The sprite assigner's autotile section becomes a simple per-group sheet+format assignment instead of a per-variant click workflow.

## Goals

- One file (`assignments.json`) declares what sheets exist, where they live on disk, and which sprites go where
- No hardcoded sheet registries, name-translation maps, or format-fallback paths in game code
- The game natively loads both Wang Blob and 8×6 grid autotile sheets — format declared per group in JSON
- Editing a source PNG in Aseprite + reloading the game shows changes immediately (no assigner round-trip)
- The sprite assigner's autotile UI is a simple per-group sheet picker with format selector
- When the sprite assigner saves, the game hot-reloads correctly without manual intervention
- The chasm autotile coordinate/image mismatch bug is fixed as a natural consequence

## Scope

What's in:
- Extending `assignments.json` with a `sheets` section (master sheet path) and new autotile format (per-group sheet path + format)
- Rewriting `tileset-loader.ts` to load images from JSON-declared paths
- Removing `AUTOTILE_SHEETS`, `SHEET_NAME_MAP`, and per-variant coordinate code from `glyph-sprite-map.ts`
- Removing `generateAutotileSheets()` and `rewriteAutotileForGame()` from the sprite assigner
- Simplifying the assigner's autotile UI to per-group sheet+format assignment
- Verifying HMR still works end-to-end
- Updating AUTOTILE.md and sprite-layer-pipeline.md

What's out:
- Production build asset hashing (future concern, not blocking dev workflow)
- Changes to autotile connection groups or bitmask computation
- Dungeon Cake-specific changes (it reads the same files, should just work)

## Constraints

- The `tilesetHmrPlugin` in `vite.config.ts` watches `assets/tilesets/` at the filesystem level. This must continue to work — no dependency on Vite's module graph for reload triggers.
- `assignments.json` is already imported statically by `glyph-sprite-map.ts`. Any schema changes must be backward-compatible or the import updated atomically.
- Both Wang Blob (7×7) and grid (8×6) format decoders already exist in the game code — this initiative wires them to data-driven config, not reimplements them.
