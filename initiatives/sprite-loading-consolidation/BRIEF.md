# Sprite Loading Consolidation

## Intent

Make `assignments.json` the single source of truth for all sprite configuration. Currently, sprite sheet metadata is scattered across three files (`tileset-loader.ts`, `glyph-sprite-map.ts`, `assignments.json`) with redundant key-translation maps that have already caused rendering bugs. The sprite assigner should be the sole writer of sprite config, and the game should blindly read whatever the JSON says.

## Goals

- One file (`assignments.json`) declares what sheets exist, where they live on disk, and which sprites go where
- No hardcoded sheet registries, name-translation maps, or format-fallback paths in game code
- When the sprite assigner saves, the game hot-reloads correctly without manual intervention
- The chasm autotile coordinate/image mismatch bug is fixed as a natural consequence of the consolidation

## Scope

What's in:
- Extending `assignments.json` with a `sheets` section (file paths per sheet key)
- Rewriting `tileset-loader.ts` to load images from JSON-declared paths
- Removing `AUTOTILE_SHEETS`, `SHEET_NAME_MAP`, and format-fallback code from `glyph-sprite-map.ts`
- Updating the sprite assigner's save endpoint to write the `sheets` section
- Verifying HMR still works end-to-end
- Updating AUTOTILE.md and sprite-layer-pipeline.md

What's out:
- Production build asset hashing (future concern, not blocking dev workflow)
- Changes to the sprite assigner UI
- Changes to autotile connection groups or bitmask computation
- Dungeon Cake-specific changes (it reads the same files, should just work)

## Constraints

- The `tilesetHmrPlugin` in `vite.config.ts` watches `assets/tilesets/` at the filesystem level. This must continue to work — no dependency on Vite's module graph for reload triggers.
- `assignments.json` is already imported statically by `glyph-sprite-map.ts`. Any schema changes must be backward-compatible or the import updated atomically.
- The sprite assigner's `generate.ts` always produces autotile sheets in 8×6 grid format. The game no longer needs to know about Wang Blob layout — that's an authoring-time concept only.
