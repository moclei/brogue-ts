# Pixel Art Foreground Tile Layers

> Parent exploration: `docs/pixel-art/pixel-art-exploration.md`

## Intent

Support sprites that are drawn with transparent regions (e.g. foliage, vegetation) by
rendering them on top of a background tile instead of on top of the cell’s flat
background color. This avoids the flat, wrong look when multiply tint fills transparent
pixels and makes overlay-style art work without editing the assets.

## Goals

- Certain TileTypes can be marked as “foreground” with an associated “background”
  TileType (e.g. FOLIAGE → FLOOR).
- When drawing a foreground TileType in tile/hybrid mode, the renderer first draws the
  background tile’s sprite, then the foreground tile’s sprite on top (same fg/bg and
  multiply for both).
- Transparent pixels in the foreground sprite show the background sprite instead of a
  solid color; lighting (multiply) still applies to both layers.
- One central place (e.g. a map or config) defines which TileTypes are foreground and
  which background to use; easy to extend.
- **Creature cells (player/monsters):** when drawing a mob, first draw the **terrain
  under that cell** (variable per cell), then the creature sprite, so transparent
  parts of the creature show the correct floor/grass/water etc.

## Scope

What's in:
- A mapping “foreground TileType → background TileType” and a getter used by the renderer.
- In the browser renderer’s tile path: when `tileType` has an associated background,
  draw background sprite then foreground sprite; otherwise keep current single-sprite draw.
- Seeding the map with a small set (e.g. FOLIAGE, DEAD_FOLIAGE, TRAMPLED_FOLIAGE → FLOOR or GRASS).
- **Variable terrain under creatures:** optional `underlyingTerrain` (TileType) for cells
  that display a creature: getCellAppearance returns it when the cell is player/monster;
  display buffer and plotChar carry it; renderer draws that terrain sprite first, then
  the creature sprite (same fg/bg and multiply for both).

What's out:
- Changing sprite assets or adding new art.
- Multi-tile / entity-layer rendering (Initiative 3).
- Game logic changes beyond getCellAppearance return value and display-buffer/plotChar plumbing for underlyingTerrain.

## Constraints

- Builds on one-to-one TileType → sprite (initiative 2): uses the same TileType→sprite map.
- Must not break text mode, null platform, or existing single-sprite tile drawing.
- Same fg/bg and multiply for both layers so lighting stays consistent.
