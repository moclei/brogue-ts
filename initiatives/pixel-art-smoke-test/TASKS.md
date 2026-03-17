# Pixel Art Smoke Test — Tasks

## Phase 1: Verify infrastructure

- [x] Confirm 'G' key handler is wired and cycles graphicsMode in the TS port
- [x] Confirm setGraphicsMode reaches the browser renderer (implement if stubbed)
- [x] Place DawnLike tileset at `rogue-ts/assets/tilesets/dawnlike/` and catalog the PNG files

# --- handoff point ---

## Phase 2: Spritesheet renderer

- [x] Build spritesheet loader — load DawnLike PNGs as HTMLImageElement objects at init
- [x] Build DisplayGlyph-to-sprite mapping — start with common glyphs (floor, wall, player, stairs, doors), fallback placeholder for unmapped
- [x] Add tile-mode branch to plotChar — background fill + drawImage from spritesheet
- [x] Implement HYBRID_GRAPHICS mode — sprites for environment, text for creatures/items
- [ ] Expand glyph mapping coverage — add creatures and items as time permits
- [x] Verify text mode still works unchanged after all changes

# --- handoff point ---

## Phase 3: Tinting and evaluation

- [x] Experiment with Canvas2D foreground color tinting (offscreen canvas + multiply)
- [x] Playtest several dungeon levels in tile mode — evaluate navigability, tinting, artifacts, performance
- [x] Document findings in docs/pixel-art/exploration.md — update status table and add findings paragraph
- [x] Note blockers or surprises for Initiative 2
