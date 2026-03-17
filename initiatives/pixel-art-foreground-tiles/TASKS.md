# Pixel Art Foreground Tile Layers — Tasks

## Phase 1: Data and getter

- [x] Add foreground → background TileType map (e.g. in `glyph-sprite-map.ts` or `tile-layers.ts`)
- [x] Implement `getBackgroundTileType(foreground: TileType): TileType | undefined`
- [x] Seed map with initial entries (e.g. FOLIAGE, DEAD_FOLIAGE, TRAMPLED_FOLIAGE → FLOOR or GRASS)

## Phase 2: Renderer two-step draw (foreground terrain)

- [x] In browser renderer tile path: when `tileType` has a background, look up background sprite and draw it first (same cell, same fg/bg and multiply)
- [x] Then draw foreground sprite as today; ensure both layers use same tint
- [x] Handle missing background sprite (e.g. draw foreground only)

# --- handoff point ---

## Phase 3: Variable terrain under creatures (underlyingTerrain)

- [x] getCellAppearance: return optional `underlyingTerrain` when the cell is drawn as player or monster (dominant terrain from tile loop before entity overlay)
- [x] Display buffer: add optional `underlyingTerrain?: TileType` to cell type; clear/copy in buffer helpers
- [x] plotCharToBuffer / plotCharWithColor: accept and store optional `underlyingTerrain`; refreshDungeonCell (and any creature write path) pass it through
- [x] commitDraws and plotChar: extend to pass `underlyingTerrain` (platform interface, null platform, browser renderer)
- [x] Browser renderer: when `underlyingTerrain` is set, draw that TileType’s sprite first (same rect, same tint), then draw creature sprite from glyph map

## Phase 4: Verify and extend

- [ ] Playtest: foliage (and other foreground terrain) render over ground; creature cells show terrain under mob, then mob sprite
- [ ] Add more foreground→background entries as needed; document how to extend
