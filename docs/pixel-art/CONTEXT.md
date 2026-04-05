# Pixel Art System — Context

Documentation for the sprite-mode rendering pipeline, autotiling, and
pixel art research.

## Feature References

| Path                           | What it covers                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `autotile/AUTOTILE.md`         | Autotile system — bitmask encoding, connection groups, spritesheet formats, data pipeline, 47-variant reference |
| `sprite-layer-pipeline.md`     | Full rendering pipeline — layer stack, tinting, blend modes, visibility overlays, F2 debug panel                |
| `tiletype-sprite-reference.md` | TileType → sprite mapping reference                                                                             |
| `VARIABLE-RES.md`              | Variable-resolution sprites — implemented feature reference: data shapes, file touch-points, HMR path, backward compat |

## Research & Exploration

| Path                                   | What it covers                                                   |
| -------------------------------------- | ---------------------------------------------------------------- |
| `sprite-variants/sprite-variation.md`  | Sprite variation approaches (randomization, environmental)       |
| `item-distinction/item-distinction.md` | Item visual distinction (color coding, silhouettes)              |
| `debug/layer-debug-tool.md`            | "Dungeon Cake" standalone web app for sprite-rendering debugging |
| `pixel-art-exploration.md`             | Original pixel art exploration (initiative scoping, research)    |
| `initial-exploration.md`               | Early pixel art feasibility investigation                        |
| `research-deep-dives.md`               | Deep dives into specific rendering techniques                    |

## Superseded

| Path                            | Superseded by                                                          |
| ------------------------------- | ---------------------------------------------------------------------- |
| `autotile-variant-reference.md` | `autotile/AUTOTILE.md` (variant table and diagrams are included there) |

## Other

| Path                      | What it is                              |
| ------------------------- | --------------------------------------- |
| `spritesheet-viewer.html` | Standalone HTML spritesheet viewer tool |
