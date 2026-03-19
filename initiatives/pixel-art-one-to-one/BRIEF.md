# Pixel Art One-to-One (TileType → Sprite)

> Parent exploration: `docs/pixel-art/pixel-art-exploration.md`

## Intent

Give each terrain and feature type (TileType) its own sprite where desired, instead of
sharing a single DisplayGlyph and varying only by color. This proves that terrain and
features can be fully differentiated visually without relying solely on color.

## Goals

- One unique sprite per TileType for terrain/features we choose to map (e.g. DEEP_WATER
  vs SHALLOW_WATER vs lava), without inflating the DisplayGlyph enum
- Pipeline carries TileType through to the renderer when the cell’s appearance is
  terrain-derived, so the sprite lookup can key by TileType first and fall back to
  DisplayGlyph
- Text, tile, and hybrid graphics modes continue to work; existing DisplayGlyph-based
  sprite mapping remains the fallback for unmapped or non-terrain cells

## Scope

What's in:
- Optional TileType on display-buffer cells (or equivalent) for terrain-derived appearance
- getCellAppearance returning (and callers storing) the dominant terrain TileType when applicable
- plotChar / BrogueConsole and commitDraws passing optional TileType through to the platform
- TileType → sprite map (build + lookup); renderer uses TileType first, then DisplayGlyph fallback
- Populating the TileType → sprite map for a representative set of terrain/features

What's out:
- Multi-tile sprites (Initiative 3)
- Animation (Initiative 5)
- Renderer abstraction refactor (Initiative 4)
- Converting sidebar or message area to sprites
- Adding new DisplayGlyph values for every TileType (we use Option B: thread TileType through the pipeline)

## Constraints

- Must not break existing text, tile, or hybrid modes
- Builds on Initiative 1 (smoke test): existing DisplayGlyph → sprite mapping and mode switch stay
- No new runtime dependencies
- Null platform and tests that don’t use plotChar must remain valid (optional TileType parameter)
