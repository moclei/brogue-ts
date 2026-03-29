# Dungeon Cake

## Intent

Build a standalone dev tool for evaluating sprites in the context of real dungeon layouts. The game's F2 debug panel renders on the same canvas as the dungeon, making sprites too small to evaluate, causing panel occlusion when zoomed, and requiring gameplay to reach interesting terrain. Dungeon Cake generates levels on demand, renders sprites at proper scale, and puts debug controls in a non-overlapping UI.

## Goals

- Generate dungeon levels outside the game bootstrap using `digDungeon` with controllable depth and seed.
- Render the 79×29 dungeon grid with actual sprites at integer zoom (1x–4x) using `SpriteRenderer.drawCellLayers()`.
- Provide per-layer debug controls: visibility toggles, tint overrides (color + alpha), alpha sliders, blend mode selectors.
- Support lighting toggle (on/off) and fog-of-war state cycling (visible, remembered, clairvoyant, telepathic, magic mapped, omniscience).
- Replace the in-game F2 debug panel. Once Dungeon Cake reaches full feature parity (including post-v1 roadmap items: cell inspection, deep-dive Canvas2D controls), the F2 panel is removed from the game.

## Scope

What's in:
- Vite + React app at `tools/dungeon-cake/` (same pattern as `tools/sprite-assigner-v2/`)
- Dungeon generation via `ArchitectContext` + `MachineContext` with stubbed `ItemOps`/`MonsterOps`
- Terrain-only rendering through `CellQueryContext` with stubbed `rogue`/`player`
- `spriteDebug` singleton bridge (React state → singleton → `SpriteRenderer`)
- Generation controls: depth (1–40), seed, generate, re-roll
- Zoom selector (1x–4x, default 2x) with `image-rendering: pixelated`
- Layer debug panel: 11 `RenderLayer` columns with visibility, tint, alpha, blend mode
- Global controls: lighting toggle, background color override, reset all
- Fog-of-war toggle: all visible, remembered, clairvoyant/telepathic/magic mapped/omniscience
- Resizable bottom debug panel with dark monospace theme

What's out (post-v1 roadmap):
- Cell inspection (click cell → per-layer breakdown, tileType, autotile bitmask/variant/group)
- Tileset hot-reload (HMR from sprite assigner saves)
- Deep-dive Canvas2D controls (per-layer CSS filter, shadow, image smoothing, flip, rotation, scale)
- `colorDances` animation (requestAnimationFrame shimmer effects)
- Minimap (viewport position overview when zoomed in)
- Creature and item placement (real `MonsterOps`/`ItemOps` generation)
- Pre-baked showcase seeds
- Live sprite assigner link (WebSocket/shared-state)
- F2 panel removal (blocked on cell inspection + deep-dive controls)

## Constraints

- Follow the `tools/sprite-assigner-v2/` project structure: independent `package.json`, Vite `resolve.alias` for `rogue-ts/src/` imports.
- Do not modify game source files. All integration is through the existing DI interfaces (`ArchitectContext`, `CellQueryContext`, `spriteDebug` singleton).
- 600-line file limit applies.
- The `ui-extraction` initiative may change `SpriteRenderer`'s constructor signature or `CellRect` type — these two interfaces should be validated after that initiative completes.
- `updateLighting()` dependency surface is not fully traced. If it requires game state beyond `pmap`/`tmap`, lighting defaults to off until resolved.
