# Pixel Art Smoke Test — Tasks

## Phase 1: Verify infrastructure

- [ ] Confirm 'G' key handler is wired and cycles graphicsMode in the TS port
- [ ] Confirm setGraphicsMode reaches the browser renderer (implement if stubbed)
- [ ] Place DawnLike tileset at `rogue-ts/assets/tilesets/dawnlike/` and catalog the PNG files

# --- handoff point ---

## Phase 2: Spritesheet renderer

- [ ] Build spritesheet loader — load DawnLike PNGs as HTMLImageElement objects at init
- [ ] Build DisplayGlyph-to-sprite mapping — start with common glyphs (floor, wall, player, stairs, doors), fallback placeholder for unmapped
- [ ] Add tile-mode branch to plotChar — background fill + drawImage from spritesheet
- [ ] Implement HYBRID_GRAPHICS mode — sprites for environment, text for creatures/items
- [ ] Expand glyph mapping coverage — add creatures and items as time permits
- [ ] Verify text mode still works unchanged after all changes

# --- handoff point ---

## Phase 3: Tinting and evaluation

- [ ] Experiment with Canvas2D foreground color tinting (offscreen canvas + source-atop)
- [ ] Playtest several dungeon levels in tile mode — evaluate navigability, tinting, artifacts, performance
- [ ] Document findings in docs/pixel-art/exploration.md — update status table and add findings paragraph
- [ ] Note blockers or surprises for Initiative 2
