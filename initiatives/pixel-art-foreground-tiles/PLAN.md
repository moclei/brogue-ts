# Pixel Art Foreground Tile Layers — Plan

## Approach

Add a **foreground → background TileType mapping**. For any TileType in that map, the
renderer draws two sprites in order: first the background TileType’s sprite (from the
existing TileType→sprite map), then the foreground TileType’s sprite. Same cell, same
fg/bg colors, same multiply tint for both. Transparent pixels in the foreground sprite
therefore reveal the background sprite instead of the cell fill color.

For **foreground terrain** (e.g. FOLIAGE), the browser renderer branches on “does
this tileType have a background?” and, if so, does a two-step draw; no pipeline
changes. For **creature cells** (player/monsters), we add optional **underlyingTerrain**:
the terrain TileType under the creature is returned from getCellAppearance, stored in
the display buffer, passed through plotChar, and the renderer draws that terrain
sprite first, then the creature sprite.

## Technical Notes

### Data: foreground → background map

- **Where:** In or alongside the sprite map module (e.g. `glyph-sprite-map.ts` or a
  small `tile-layers.ts`). A `Map<TileType, TileType>` or equivalent: “when drawing
  TileType X, first draw TileType Y.”
- **Getter:** `getBackgroundTileType(foreground: TileType): TileType | undefined`.
  Returns `undefined` when the TileType is not a foreground overlay (current
  single-sprite behavior).
- **Initial entries:** e.g. FOLIAGE → FLOOR, DEAD_FOLIAGE → FLOOR, TRAMPLED_FOLIAGE →
  FLOOR (or GRASS where appropriate). Extensible so more TileTypes can be added later.

### Renderer: two-step draw

- **Where:** `browser-renderer.ts`, inside the tile/hybrid branch of `plotChar`, after
  we’ve decided to draw a sprite (we have `tileType` and/or `inputChar`).
- **Logic:**
  1. If `tileType !== undefined` and `getBackgroundTileType(tileType)` returns a
     `backgroundTileType`, look up the sprite for `backgroundTileType` (from
     `tileTypeSpriteMap`). If found, draw that sprite first (same dest rect, same
     tint: fill cell with bg, then draw sprite with multiply fg). Then draw the
     foreground sprite (same as today: sprite for `tileType` with multiply).
  2. Else: current behavior — draw one sprite (or glyph fallback).
- **Order:** Background sprite first, then foreground sprite. Both use the same
  lighting (fg/bg and multiply) so the result is consistent.

### Variable terrain under creatures (underlyingTerrain)

- **getCellAppearance:** When the displayed appearance is a creature (player or monster),
  we already computed the dominant terrain TileType in the tile loop before overwriting
  with the entity. Return it as optional **`underlyingTerrain?: TileType`** (only when
  the cell is drawn as a creature). So return shape extends to
  `{ glyph, foreColor, backColor, tileType?, underlyingTerrain? }`.
- **Display buffer:** Add optional **`underlyingTerrain?: TileType`** per cell. When
  writing a creature cell (from refreshDungeonCell or any path that writes
  creature appearance), store the underlyingTerrain from getCellAppearance; when
  writing terrain-only, leave it unset.
- **plotCharToBuffer / plotCharWithColor:** Accept optional `underlyingTerrain` and
  write it to the cell. **commitDraws:** include it in the diff and pass it to
  **plotChar**. **BrogueConsole.plotChar:** extend with optional
  `underlyingTerrain?: TileType` (e.g. 11th parameter or grouped with tileType).
- **Renderer:** In the tile/hybrid branch, before drawing the main sprite: if
  **`underlyingTerrain`** is set, look up that TileType’s sprite (from
  tileTypeSpriteMap, with DisplayGlyph fallback if needed) and draw it first (same
  cell rect, same fg/bg and multiply). Then draw the main content: creature sprite
  from glyph map (or terrain sprite if tileType). So mobs get “terrain underfoot,
  then creature on top” with correct lighting.

### Edge cases

- If the background TileType (fixed or underlyingTerrain) has no sprite in the
  TileType→sprite map, draw the foreground/main sprite only.
- Cells without `tileType` and without `underlyingTerrain` (e.g. item-only): unchanged
  single glyph/sprite path.

## Open Questions

- None at kickoff. During implementation: whether to put the map in `glyph-sprite-map.ts`
  or a new file (e.g. `tile-layers.ts`); resolve by keeping sprite/layer data together
  or separating by concern.
