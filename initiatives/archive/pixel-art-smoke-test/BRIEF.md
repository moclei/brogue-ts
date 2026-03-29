# Pixel Art Smoke Test

> Parent exploration: `docs/pixel-art/pixel-art-exploration.md`

## Intent

Prove that sprite-based rendering works end-to-end in the TypeScript port, using the
DawnLike 16x16 tileset as placeholder art. Verify the existing `GraphicsMode` / 'G' key
infrastructure, evaluate color tinting on real sprites, and document findings to inform
future initiatives.

## Goals

- The game is playable in tile mode with DawnLike sprites replacing Unicode glyphs
- The existing 'G' key toggle switches between text and sprite rendering
- Color tinting (lighting, status effects) is experimentally applied and visually evaluated
- Findings are documented back to the exploration doc

## Scope

What's in:
- Spritesheet loading (DawnLike PNGs)
- `DisplayGlyph` → sprite region mapping (~120 entries, built incrementally with fallback)
- Canvas2D sprite rendering via `drawImage` in `plotChar`
- HYBRID_GRAPHICS mode (sprites for terrain, text for creatures/items)
- Canvas2D color tinting experiment (`globalCompositeOperation` technique)
- Playtest evaluation and findings writeup

What's out:
- Animation of any kind
- Renderer abstraction / plugin architecture (Initiative 3)
- Multi-tile sprites (Initiative 5)
- Sidebar or message area conversion to sprites
- New external dependencies (no PixiJS, no WebGL — Canvas2D only)
- Production-quality art or complete sprite coverage

## Constraints

- Must not break the existing text renderer — text mode must continue to work
- No new runtime dependencies
- DawnLike tileset (CC-BY-SA 4.0) placed at `rogue-ts/assets/tilesets/dawnlike/`
- 16x16 pixel tile size
