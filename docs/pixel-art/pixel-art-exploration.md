# Pixel Art Graphics — Master Exploration

> **What this document is:** The master research, planning, and tracking reference for
> building a production-quality pixel art graphics system in BrogueCE's TypeScript port.
> It sits above individual initiatives and provides the big picture: what we've learned,
> what research is needed, what technical challenges exist, what decisions have been made,
> and what the roadmap looks like.
>
> **What this document is not:** A task list, a technical spec, or a design doc for any
> single initiative. Those belong in each initiative's own BRIEF/PLAN/TASKS.
>
> **Prior art:** `docs/pixel-art/initial-exploration.md` — the original exploration doc
> written for the smoke-test approach. Contains SWOT analysis, technical comparisons, and
> early initiative planning that informed this document.
>
> **Lifecycle rule:** When a child initiative is created from this document's roadmap, its
> BRIEF links back here. When it completes, the roadmap table below is updated. This is the
> single source of truth for the overall pixel art effort.

---

## 1. Context

BrogueCE is a turn-based dungeon crawler rendered as Unicode glyphs on a 100x34 character
grid (79x29 dungeon viewport + 20-column sidebar + 3-row message area). Each cell carries
a `DisplayGlyph` enum value plus foreground and background RGB colors (0-100 scale). The
color system is central to gameplay: lighting, status effects, terrain variation, and fog
of war all express through per-cell color tinting.

We want to add pixel art sprites as an alternative rendering mode alongside the existing
ASCII glyphs — not replace them. The ASCII renderer must remain a first-class option
(players can switch via the G key). The goal is a proper, extensible, production-quality
sprite graphics layer that coexists with text rendering — not another prototype.

### Current rendering pipeline

```
Game Logic → DisplayBuffer (100x34 cells, each: DisplayGlyph + fg RGB + bg RGB + optional TileType + optional underlyingTerrain)
           → commitDraws() diffs against previous frame
           → plotChar() draws changed cells to Canvas2D
```

The sole rendering entry point is `plotChar()` in `browser-renderer.ts`. In text mode it
draws Unicode glyphs via `fillText()`. In tile/hybrid mode it draws sprites via `drawImage()`
with multiply tinting. The game logic is untouched by graphics mode changes.

---

## 2. Prior Art and Lessons Learned

Three prototype initiatives have been completed. They proved the basic approach works but
left the codebase with ad-hoc rendering code that needs architectural cleanup.

### Initiative: pixel-art-smoke-test (complete)

**What it proved:** End-to-end sprite rendering works within the existing `plotChar` contract.

- Loaded DawnLike 16x16 tileset PNGs as `HTMLImageElement` at init
- Built `DisplayGlyph -> SpriteRef` mapping in `glyph-sprite-map.ts`
- Added tile/hybrid branch in `plotChar` — sprites in dungeon viewport only; sidebar and
  messages stay as text
- G-key mode switching (Text / Tiles / Hybrid) with immediate full redraw

**Key findings:**
- Canvas2D `multiply` tinting preserves sprite detail and responds to Brogue's lighting.
  `source-atop` produced flat, washed-out results.
- Unmapped glyphs in the viewport fall back to text rendering (not magenta squares), keeping
  monsters, items, and hover path readable.
- Viewport-only sprite rendering avoids sidebar/message corruption.

### Initiative: pixel-art-one-to-one (complete, playtest pending)

**What it proved:** Each terrain/feature TileType can have its own sprite without inflating
the DisplayGlyph enum.

- Chose Option B: thread `TileType` through the display pipeline as an optional field on
  `CellDisplayBuffer`, rather than adding new DisplayGlyph values per TileType.
- `getCellAppearance` returns the dominant terrain TileType; callers store it in the display
  buffer.
- `plotChar` extended with optional `tileType` parameter; renderer looks up
  `tileTypeSpriteMap` first, falls back to `spriteMap` (DisplayGlyph).
- ~40 TileTypes mapped to DawnLike sprites (floors, walls, vegetation, liquids, doors,
  stairs, bridges, effects).

### Initiative: pixel-art-foreground-tiles (complete)

**What it proved:** Transparent overlay sprites work with a two-layer draw approach.

- Foreground-to-background TileType map (`FOLIAGE -> FLOOR`, etc.) in `glyph-sprite-map.ts`.
- Renderer draws background sprite first, then foreground sprite; transparent pixels in
  the foreground show the background sprite.
- `underlyingTerrain` field added for creature cells so the terrain under a mob draws first.
- Critical fix: `destination-in` composite operation after `multiply` restores the sprite's
  original alpha mask (multiply alone destroys transparency).

### Prototype code in the codebase

These initiatives left working but architecturally rough code in:

| File | What's there | Build forward or rework? |
|------|-------------|------------------------|
| `browser-renderer.ts` | Tile/hybrid branch in `plotChar` with `drawSpriteTinted` closure, foreground/background layer logic, creature underlyingTerrain, debug flags | Rework: extract into a separate `SpriteRenderer` |
| `glyph-sprite-map.ts` | DisplayGlyph->sprite map, TileType->sprite map, foreground->background map | Build forward: maps are data, relocate into sprite renderer |
| `cell-appearance.ts` | Returns `tileType` and `underlyingTerrain` on `CellDisplayBuffer` | Build forward: pipeline extension is sound |
| `display.ts` | `plotCharToBuffer` / `plotCharWithColor` accept optional `tileType` and `underlyingTerrain` | Build forward: plumbing is correct |
| `platform.ts` | `commitDraws` diffs and passes `tileType` / `underlyingTerrain` to `plotChar` | Build forward: diff logic works |
| `bootstrap.ts` | Loads tileset, builds sprite maps, passes to `createBrowserConsole` | Rework: move to renderer factory/init |
| `tileset-loader.ts` | `TILE_SIZE` constant, tileset loading | Build forward |

---

## 3. Research: Open Source References

> **Status:** All research complete. Three deep-dives (tiles.c, DCSS, CDDA) finished.
> Reference-tier and skip-tier candidates reviewed. Synthesis and recommendations in
> Section 3.S below.

### Priority Tier: Deep-Dive Candidates

These are the candidates worth cloning/downloading and studying at the source level.

#### 3.1. Tiles.c in BrogueCE (C source)

- **Link:** `src/platform/tiles.c` (813 lines), `src/platform/sdl2-platform.c` (mapping
  logic), `src/brogue/Rogue.h` (`enum displayGlyph`)
- **Problem it solves:** Sprite rendering for the same game, using SDL2
- **Relevance:** **Deep-dive** — this is our most direct reference. Same game, same
  `plotChar` abstraction, same display model.
- **Status:** Deep-dive complete

##### Deep-dive findings

**A. White-sprite tinting model**

The C tile renderer uses a fundamentally different tinting approach from our Canvas2D
prototype. Understanding the difference is critical for art pipeline decisions.

Source sprites in `tiles.png` (2048×5568, 128×232px per tile, 24 rows × 16 cols = 384
tiles) are white/grayscale outlines on a black background. During the `downscaleTile()`
downscaling step, the pixel luminance from the source PNG is converted entirely to alpha:

```c
uint32_t alpha = (value == 0 ? 0 : value > 64770 ? 255 : round(sqrt(value)));
*pixel++ = (alpha << 24) | 0xffffffU;  // white pixel, variable opacity
```

Every pixel in the resulting texture is pure white (RGB 1,1,1) with opacity derived from
the original grayscale value. Color is then applied at render time in a two-pass model:

1. **Background pass:** `SDL_SetRenderDrawColor(bgR, bgG, bgB, 255)` +
   `SDL_RenderFillRect` fills the cell with the background color.
2. **Foreground pass:** `SDL_SetTextureColorMod(fgR, fgG, fgB)` multiplies the all-white
   texture by the foreground color, then `SDL_RenderCopy` alpha-blends it over the
   background. Since white × color = color, the foreground color *becomes* the sprite
   color. The original grayscale values control only the alpha (edge softness, weight).

**Comparison with our Canvas2D approach:**

| Aspect | C tiles.c (white sprites) | Our prototype (colored sprites + multiply) |
|--------|--------------------------|-------------------------------------------|
| Sprite color | None — grayscale/white only | Full-color DawnLike sprites |
| Foreground tint | Color *becomes* the sprite | Color *modifies* existing colors |
| Background handling | Solid fill behind sprite | Solid fill behind sprite |
| Artistic expression | Low — sprites are just shapes | High — sprites carry inherent color |
| Tint fidelity | Perfect — Brogue's lighting colors show exactly | Approximate — multiply can muddy bright colors |
| Alpha channel | Naturally preserved (luminance → alpha) | Requires `destination-in` composite fix |
| Art pipeline complexity | Simpler — artist draws shapes, game colors them | Higher — artist chooses colors that must tint well |

**Recommendation:** White sprites are the right choice for *production* art in this game.
Brogue's color system is not a cosmetic tint — it encodes gameplay information (lighting,
terrain type, status, fog). White sprites let the game's colors express fully without
fighting artist-chosen hues. Our current colored-sprite prototype works for DawnLike
placeholders, but the production art pipeline should target white/grayscale sprites.

The Caves of Qud 3-color system (Section 3.7) offers an interesting middle ground: black
pixels → foreground color, white pixels → detail color, transparent → background. This
preserves some artistic control (two-tone sprites) while still responding to game coloring.
Worth prototyping alongside pure white sprites when we reach the art pipeline initiative.

**B. Tile processing categories**

Each tile has a processing mode defined in `TileProcessing[24][16]`, controlling how it
scales to fit variable-size screen cells:

| Mode | Max stretch | Aspect ratio | Alignment | Used for |
|------|------------|--------------|-----------|----------|
| `'s'` (stretch) | Unlimited | Not preserved | Fill entire cell | Walls, doors, backgrounds, terrain that must tile seamlessly |
| `'f'` (fit) | 20% | Preserved | Centered, blank space at top/bottom absorbed | Items, objects, features with defined shape |
| `'t'` (text) | 40% | Preserved | X-height and baseline pixel-aligned across all text tiles | Letters, digits, punctuation |
| `'#'` (symbols) | 40% | Preserved | Centered | Non-letter Unicode symbols (♦, •, ≈, etc.) |

The `downscaleTile` function implements this by computing `glyphWidth`/`glyphHeight`
within each mode's constraints, then using 5-stop piecewise-linear coordinate mapping
(splitting the tile into 16 sub-regions via 3 horizontal + 3 vertical cut lines) for
independently aligned downscaling.

Text-mode specifics: `TEXT_X_HEIGHT` (100px) and `TEXT_BASELINE` (46px) in the source
PNG are pixel-aligned on screen, ensuring letters line up vertically regardless of glyph
height differences. A custom brightness curve (`value < 255*255/2 ? value/2 : value*3/2
- 255*255/2`) reduces perceived boldness at small sizes.

**Do we need equivalent logic?** Partially. Our sprite renderer doesn't downscale from
high-res source art — we draw pre-sized sprites via `drawImage`. But the *categories*
matter:

- **Stretch mode** is needed for terrain tiles that must fill cells completely (walls,
  floors). Our current approach already implicitly does this (`drawImage` to full cell).
- **Fit mode** matters if we ever have sprites of varying visual density — e.g., a large
  dragon sprite vs. a small rat sprite that shouldn't fill the cell edge-to-edge. Not
  critical for 16×16 pixel art where everything fits the grid, but becomes important at
  larger tile sizes (24×24, 32×32) or with mixed-size tilesets.
- **Text mode** is irrelevant — our text rendering stays in `TextRenderer` via `fillText`.
- **Symbol mode** is irrelevant for the same reason.

**Recommendation:** Don't implement tile processing modes now. Revisit if we adopt tilesets
larger than 16×16 or if sprite size variation becomes a design goal. If needed, it would
be a simple `SpriteConfig` property per tile: `{ mode: 'stretch' | 'fit', maxStretch? }`.

**C. Multi-resolution texture strategy**

The C renderer solves the non-integer division problem: 100 columns into (say) 1600px
gives tiles of exactly 16px each, but 100 into 1593px gives 15.93px — some tiles must be
15px and others 16px.

The solution: pre-render all 384 tiles at 4 sizes — `W×H`, `(W+1)×H`, `W×(H+1)`,
`(W+1)×(H+1)` — into 4 GPU textures. During rendering:

```
tileWidth  = ((x+1) * outputWidth / COLS) - (x * outputWidth / COLS)   // 15 or 16
tileHeight = ((y+1) * outputHeight / ROWS) - (y * outputHeight / ROWS) // varies
textureIndex = (tileWidth > baseTileWidth ? 1 : 0) + (tileHeight > baseTileHeight ? 2 : 0)
```

Each cell picks the texture whose tile dimensions match its computed width/height. The 5
rendering passes (1 background + 4 tile passes) group by texture to minimize GPU state
changes (OpenGL texture binding is expensive if interleaved).

When tiles exceed `MAX_TILE_SIZE` (64px), a single texture is used with `linear`
interpolation instead of `nearest`, accepting slight blur.

**Do we need this?** No, not directly. Canvas2D's `drawImage(src, sx, sy, sw, sh, dx, dy,
dw, dh)` handles non-integer scaling natively — the browser composites per-cell without
requiring pre-rendered texture atlases at multiple sizes. CSS `image-rendering: pixelated`
on the canvas gives us nearest-neighbor scaling for the pixel-art aesthetic.

The deeper insight is the *problem* this solves: non-integer cell sizes in a fixed grid.
We face the same issue. Our current renderer computes `cellWidth = canvas.width / COLS`
and rounds, which can leave 1-2px gaps. The C approach of computing each cell's position
as `x * outputWidth / COLS` (integer division, progressive) is cleaner and should be
adopted in our cell-sizing logic regardless of sprite vs. text rendering.

**Recommendation:** Don't replicate the 4-texture strategy. Do adopt the progressive
integer-division cell positioning: `cellX = x * canvasWidth / COLS`, `cellWidth =
((x+1) * canvasWidth / COLS) - cellX`. This eliminates sub-pixel gaps without multiple
texture copies.

**D. Procedural wall tops**

Three specific tile positions generate diagonal sine-wave patterns instead of using
sprite art:

- Row 16, column 2 (`charIndex` 258)
- Row 21, column 1 (`charIndex` 337)
- Row 22, column 4 (`charIndex` 356)

The pattern: `sin(2π × (x/W × numH + y/H × numV)) / 2 + 0.5`, where `numH` and `numV`
scale with tile size (2–6 horizontal waves, 2–11 vertical waves). This produces diagonal
stripes that adapt to any tile size, used for the decorative tops of stone walls.

For row 21 (the main wall top), the sine wave fills the entire tile. For rows 16/22, it
fills only the top half (stops when it hits existing non-empty pixel rows). The wave
count adapts: `numHorizWaves = clamp(round(tileWidth × 0.25), 2, 6)`, so the pattern
stays roughly the same density regardless of resolution.

**Do we need this?** Unlikely. Procedural wall tops exist in the C version because the
white-sprite tinting model can't carry detailed wall-top textures (there's no color
information in the sprite). With colored pixel art sprites, we'd draw actual wall-top
art. Additionally, autotiling (Initiative 3) would replace the current wall-top selection
logic with neighbor-aware variant sprites that include proper edges and transitions.

**Recommendation:** Skip procedural wall tops. Use authored pixel art for wall transitions
and let the autotiling system handle variant selection.

**E. Tile-to-glyph mapping (charIndex)**

The mapping from game logic to tile grid is a three-step chain:

1. **Game logic** emits `enum displayGlyph` values (defined in `Rogue.h`). Values 0–127
   are ASCII. Values 128+ are game-specific glyphs (`G_UP_ARROW=128`, `G_WALL=132`,
   `G_FLOOR=277`, etc.).

2. **`fontIndex()` in `sdl2-platform.c`** converts displayGlyph to charIndex:
   - ASCII (0–127): `charIndex = glyph` (direct mapping to rows 0–7 of the tile grid)
   - G_UP_ARROW/G_DOWN_ARROW: special-cased to font positions 0x90/0x91 (always text)
   - Tile mode: `charIndex = glyph + 128 - 2` (rows 8–23). The `-2` skips the two
     arrow glyphs that stay as text.
   - Hybrid mode: `isEnvironmentGlyph()` decides whether a glyph gets tile or text
     treatment. Environment glyphs (walls, floors, doors, etc.) use tiles; items and
     creatures use text/Unicode fallback.
   - Text/Unicode fallback: Unicode code points are mapped to specific positions in
     rows 8–9 (special symbols like ♦, •, Ω, etc.)

3. **`tiles.c` rendering** converts charIndex to tile grid position:
   `tileRow = charIndex / 16`, `tileColumn = charIndex % 16`.

The 24×16 tile grid layout:
- **Rows 0–7** (charIndex 0–127): ASCII font — letters, digits, punctuation, special
  symbols. These are the text-mode glyphs.
- **Rows 8–15** (charIndex 128–255): Unicode symbol alternatives for text mode — special
  roguelike symbols (middle dot, diamond, arrows, etc.) at specific positions; rest
  available for expansion.
- **Rows 16–23** (charIndex 256–383): Game-specific tile art — walls, floors, doors,
  creatures, items, features. Mapped from `displayGlyph` enum values via the `+128-2`
  offset.

**Mapping to our TypeScript port:**

Our `DisplayGlyph` enum in `types/enums.ts` mirrors the C `displayGlyph` enum. Our
`glyph-sprite-map.ts` uses a `Map<DisplayGlyph, SpriteRef>` for the tile lookup,
bypassing the charIndex indirection entirely. The charIndex scheme is an artifact of the
single-PNG-atlas approach where position = identity. Our approach (explicit map from
enum to spritesheet coordinates) is more flexible and doesn't constrain the spritesheet
layout.

**F. Confirmed limitations (no change from preliminary scan)**

The C tile renderer has none of:
- Autotiling / adjacency-aware tile selection
- Layer compositing (one sprite per cell, period)
- Creature facing or directional sprites
- Animation of any kind
- Alpha blending between multiple sprites in one cell

These are exactly the gaps we're solving with Initiatives 2–7. The C renderer is a useful
reference for the tinting model and cell-sizing math, but not for the rendering
architecture we need to build.

#### 3.2. DCSS tiles (Dungeon Crawl Stone Soup)

- **Link:** https://github.com/crawl/crawl (main), https://github.com/crawl/tiles (art assets)
- **Problem it solves:** Mature tile system for a complex roguelike — autotiling, layered
  sprites, directional creatures, effect overlays, viewport scrolling
- **Relevance:** **Deep-dive** — the most mature open-source roguelike tile system. Solves
  several of the exact problems we face.
- **Status:** Deep-dive complete

##### Deep-dive findings

**A. tile_flavour: how wall and floor variants work**

DCSS does **not** use bitmask-based autotiling for walls and floors. Instead it uses a
`tile_flavour` struct stored per-cell at level generation time (in `tile_env.flv[x][y]`),
containing:

```cpp
struct tile_flavour {
    tileidx_t floor;     // specific floor tile (pre-picked variant)
    tileidx_t wall;      // specific wall tile (pre-picked variant)
    tileidx_t feat;      // optional feature override (stairs, doors)
    unsigned short special; // random seed for variant picking + door offsets
    unsigned short floor_idx, wall_idx, feat_idx; // indices within variant set
};
```

**Variant selection** happens once per cell during `tile_init_flavour()` (called at level
creation). Each floor/wall tile type has multiple variants defined in the rltiles `.txt`
files with `%weight` directives. The function `pick_dngn_tile()` uses a deterministic hash
(seeded from birth_time + branch + depth + x/y position) to select a variant, weighted by
the `%weight` values. Once picked, the variant is stored in `tile_flavour` and never
recomputed unless the level is regenerated. This is a **static random variant** system,
not adjacency-based autotiling.

For example, `TILE_WALL_BRICK_DARK_1` has 12 variants at weights 100/100/100/100/10/10/10/10/5/5/5/5.
The first four are common; the last eight are rare accent tiles. The hash picks one variant
per cell, creating visual variety without neighbor-awareness.

**Depth-based wall sets:** For the Dungeon and Depths branches, wall tile selection is more
complex. `_get_dungeon_wall_tiles_by_depth()` returns multiple candidate tile bases with
overlapping depth ranges (e.g., BRICK_DARK_1 on D:1-5, BRICK_DARK_2 on D:3-8 with torch
variants, BRICK_DARK_3 on D:6-11). `_pick_dngn_tile_multi()` picks among candidates by
total weight, then picks a variant within the winner. Torch tiles get extra weight on the
last floor of each branch. This creates smooth visual transitions between dungeon depths
without any adjacency logic.

**Branch-specific tile mapping:** `tile_default_flv()` maps each branch to a default
wall/floor tile pair via a large switch statement (e.g., `BRANCH_CRYPT` → `ROCK_WALL_CRYPT`
+ `FLOOR_CRYPT`). Some branches like Abyss and Pandemonium randomize within the branch
using `tile_dngn_coloured()` to apply color variations based on `env.rock_colour`/`env.floor_colour`.

**Color variations (the `%variation` system):** The rltiles build system generates colored
variants of tiles at build time using `%hue`, `%lum`, `%desat` directives. For example,
`DNGN_STONE_WALL` has 15 color variants (blue, green, cyan, red, magenta, brown, darkgray,
yellow, lightblue, etc.), each produced by hue-shifting or luminance-adjusting the base PNG.
`tile_dngn_coloured(base, colour)` maps a tile + color enum to the corresponding variant.
This is used for Abyss/Pan random wall colors and grid-specific color overrides.

**Key insight for our system:** DCSS achieves visual richness through *weighted random
variant selection*, not through adjacency-based autotiling. Walls all use the same tile type
within a branch/depth — they just pick different random variants from a pool of 4-16 sprites.
This is dramatically simpler than 8-bit bitmask autotiling but produces less sophisticated
results (no distinct edge/corner tiles, no transitions between terrain types). DCSS
compensates with the floor halo and wall shadow overlay systems (see below).

**B. Floor halo system — DCSS's adjacency-aware rendering**

The closest thing to autotiling in DCSS is `tile_floor_halo()` in `tileview.cc`. This is a
9-tile directional overlay system: for a given target feature type (e.g., trees), floor cells
adjacent to the target get a special halo tile that transitions visually from the target
into the floor.

The halo tiles are defined in dc-floor.txt with directional names:

```
grass_n HALO_GRASS    # north edge
grass_ne              # northeast corner
grass_e               # east edge
grass_se              # southeast corner
grass_s, grass_sw, grass_w, grass_nw  # other edges/corners
grass_full            # fully surrounded
```

The algorithm in `tile_floor_halo()` is a two-pass system:

1. **First pass:** For each floor cell adjacent to the target, check all four cardinal
   neighbors. Classify each neighbor as "normal floor" (`l_nrm`, `r_nrm`, etc.) or "special
   floor" (also adjacent to target: `l_spc`, `r_spc`). Based on these 8 booleans, select one
   of the 9 directional tiles (N, NE, E, SE, S, SW, W, NW, FULL). Ambiguous cases use
   `coinflip()` or `_jitter()` for randomization.

2. **Second pass:** Clean up inconsistent adjacent tiles. If a SPECIAL_N tile is next to a
   SPECIAL_S tile horizontally, replace them with SPECIAL_NE/SPECIAL_SW to create a
   proper visual separation.

This system is used for grass halos around trees, dirt halos around certain features, and
vault floor borders. It operates at the **floor tile level** (replacing `flv.floor`), not
as composited overlays.

Separately, dc-floor.txt defines directional **overlay sprites** for terrain transitions:

- `SLIME_OVERLAY` — N/E/S/W/NW/NE/SE/SW overlays for slime edges
- `ICE_OVERLAY` — same 8 directions for ice edges
- `WAVE` tiles — shallow/deep water wave edges in 8 directions
- `SHORE` tiles — water-to-land transitions

These overlays are alpha-composited on top of the floor tile, providing edge transitions
between terrain types. The system uses **4-directional + 4-diagonal = 8-direction overlays**,
not bitmask autotiling. Each direction is a separate pre-authored sprite.

**Wall shadow overlays:** dc-wall.txt defines 7 directional wall shadow tiles
(`shadow_w`, `shadow_nw`, `shadow_n`, `shadow_ne`, `shadow_e`, `shadow_w_top`,
`shadow_e_top`) plus darker variants. These are drawn on floor tiles adjacent to walls
to give walls a sense of depth and occlusion. The shadow direction depends on which side
of the wall the floor is on.

**Relevance to our system:** The floor halo approach is simpler than full bitmask autotiling
but less flexible. It works well for transition borders (grass→stone, water→land) but cannot
produce the range of edge/corner/T-junction variants that a 47-tile blob set provides.
The overlay approach (separate directional edge sprites composited on the floor) is closer
to what we'd want for water edges and terrain transitions — it separates the edge art from
the base terrain tile, so one set of edge sprites works with any floor tile.

**C. Layer compositing model**

DCSS uses a **3-layer model** with flags, not a deep layer stack:

| Layer | Storage | Content |
|-------|---------|---------|
| `bk_bg` | `tile_env.bk_bg[x][y]` | Background: dungeon feature tile (floor, wall, door, stair, trap, etc.) + flag bits |
| `bk_fg` | `tile_env.bk_fg[x][y]` | Foreground: monster tile, item tile, or invisible-monster indicator |
| `bk_cloud` | `tile_env.bk_cloud[x][y]` | Cloud layer: gas, fog, steam, etc. |

Additional visual information is packed into **flag bits** on `bk_bg`:

- `TILE_FLAG_WATER` — cell contains water/lava (affects rendering)
- `TILE_FLAG_NEW_STAIR` / `TILE_FLAG_NEW_TRANSPORTER` — discovery markers
- `TILE_FLAG_CURSOR3` — autopickup highlight
- `TILE_FLAG_TRAV_EXCL` / `TILE_FLAG_EXCL_CTR` — travel exclusion markers
- `TILE_FLAG_RAMPAGE` — rampage target indicator
- `TILE_FLAG_S_UNDER` — "something under" (item under monster)
- Tentacle overlay flags (NW/NE/SE/SW for kraken tentacle corner rendering)

The `packed_cell` struct (used for actual rendering) extends this with computed properties:

- `halo` — halo type (divine halo, umbra, orb glow) applied as overlay
- `is_bloody` / `blood_rotation` — blood splatter overlay with rotation
- `is_liquefied` / `is_sanctuary` / `is_silenced` / `is_blasphemy` — status overlays
- `travel_trail` — travel path direction indicator
- `flv` — the `tile_flavour` for variant resolution
- `icons` — set of status effect icons for monsters (8x8/10x10 sprites)

**Draw order** (inferred from the data flow):

1. Background tile (`bk_bg` → resolved via `apply_variations` using `flv`)
2. Floor overlays (halo edges, slime/ice/wave overlays, wall shadows)
3. Item or monster (`bk_fg`) — items have a stacking indicator (`S_UNDER` flag)
4. Cloud overlay (`bk_cloud`) — semi-transparent gas/fog
5. Status overlays (halo, blood, sanctuary, liquefied, etc.)
6. Status icons (on monsters: 8x8/10x10 icons for conditions)
7. UI overlays (cursor, travel trail, exclusion zones, name tags)

**Blend modes:** DCSS does not use Canvas2D-style blend modes. Tiles are 32x32 PNGs with
alpha channels. Foreground sprites (monsters, items) are drawn with standard alpha
compositing over the background. Clouds have built-in semi-transparency in their PNGs.
Status overlays like halos and sanctuary use pre-authored semi-transparent sprites. There
is no multiply tinting, additive blending, or per-pixel color manipulation at render time
— all color information is baked into the tile PNGs (or generated at build time via the
`%hue`/`%lum`/`%desat` rltiles directives).

**Relevance to our system:** DCSS's 3-layer model is much simpler than our proposed 11-layer
stack. Their model works because: (a) items and monsters are mutually exclusive per cell
(one `bk_fg` value), (b) clouds have their own dedicated layer, (c) overlays and status
effects are composited as flags/properties rather than independent layers. Our system needs
more layers because Brogue has per-cell lighting tints (requiring a multiply pass), surface
effects (foliage, fungus) that coexist with items/creatures, and bolt animations. But DCSS
proves that a production roguelike can work with far fewer explicit layers than we initially
proposed — the key is treating overlays as composited decorations rather than full layers.

**D. Creature/monster tile selection — no facing direction**

DCSS does **not** implement creature facing direction. Monster tiles are static sprites
with a single fixed orientation. The tile selection pipeline:

1. `tileidx_monster()` takes a `monster_info` and returns a tile index + flags
2. `tileidx_monster_base()` is a massive switch on monster type → tile enum
3. Humanoid monsters can display wielded weapons dynamically via `tilemcache.cc`
   (the weapon sprite is offset and composited at a hand position defined per monster)
4. Weapon sprites can be "mirrored" (`mirror_weapon()` in `tilepick-p.cc`) — this flips
   the weapon sprite horizontally for left-hand wielding, but does **not** flip the monster

The only direction-aware monster rendering in DCSS is for **kraken tentacles**: tentacle
segments have directional sprites (N/NE/E/SE/S/SW/W/NW) and a connector system with
diagonal overlay sprites. This is a special-case system for a single multi-tile monster,
not a general facing system.

**Monster variant selection:** Some monsters have multiple tile variants. The variant is
stored in `mon.props[TILE_NUM_KEY]` as a random number assigned at spawn time. Most monster
tiles have exactly one variant. Ugly things pick their tile based on `mon.colour`.

The `tiles_creation.txt` design guide explicitly shows the convention: "Humanoid monsters,
in particular uniques, will usually be facing to the left with their right hand outstretched
so they can be displayed wielding their current weapon." All monster sprites face the same
direction by convention — there is no runtime flipping or multi-directional sprites.

**Relevance to our system:** DCSS's lack of creature facing validates our 2-directional
(left/right flip) approach as a reasonable minimum. The most mature open-source roguelike
tile system doesn't bother with creature facing at all, and it works fine visually. If we
implement horizontal flip based on last-move-direction, we'll already exceed DCSS's
capability here.

**E. Tile assignment: feature → tile mapping**

Dungeon features are mapped to tiles via `tileidx_feature_base()` in `tilepick.cc` — a
switch on `dungeon_feature_type` → tile enum. This returns a "generic" tile (e.g.,
`TILE_FLOOR_NORMAL`, `TILE_WALL_NORMAL`, `TILE_DNGN_CLOSED_DOOR`).

Then `apply_variations()` resolves the generic tile to a specific variant:

1. `TILE_FLOOR_NORMAL` → replaced by `flv.floor` (the per-cell pre-picked floor variant)
2. `TILE_WALL_NORMAL` → replaced by `flv.wall` (the per-cell pre-picked wall variant)
3. Door tiles → offset by `flv.special` to select gate position variants
4. Web traps → 4-bit cardinal neighbor check (solid/web neighbors encoded as bitmask 0-15,
   selecting from 15 directional web sprites). This is the only true bitmask autotiling
   in DCSS's entire codebase.
5. Other features → `pick_dngn_tile(tile, flv.special)` selects a weighted random variant

The two-step resolution (generic → branch-specific → variant-specific) is clean and avoids
embedding branch knowledge into the game logic. Game code emits `DNGN_FLOOR`; the tile
system resolves it to `TILE_FLOOR_SNAKE_C + 2` (third variant of Snake Pit floor C).

**`tilepick.cc` is the real tile brain (5179 lines).** It handles:
- All feature→tile mapping (`tileidx_feature_base`)
- All monster→tile mapping (`tileidx_monster_base`, 2000+ lines of switch cases)
- All item→tile mapping (`tileidx_item`, `tileidx_weapon_base`, `tileidx_armour_base`)
- Branch-specific tile overrides (`_apply_branch_tile_overrides`)
- Color-based tile variation (`tile_dngn_coloured`)
- Missile direction octant calculation
- Travel trail direction encoding
- Status icon mapping (50+ monster status → icon tile mappings)

**F. rltiles definition format**

The `.txt` files in `rltiles/` are a custom DSL processed by a build tool to generate:
(a) packed tilesheet PNGs, and (b) C++ enum definitions + variant count/weight arrays.

Key directives:
- `%sdir dngn/wall` — set source directory for subsequent tile PNGs
- `%weight 10` — set probability weight for subsequent variant tiles
- `filename ENUM_NAME` — map a PNG file to an enum value; subsequent lines without
  an enum name are additional variants of the same tile
- `%variation BASE color` — declare a color variant produced by hue/lum/desat transforms
- `%hue FROM TO` — shift hue FROM degrees to TO degrees
- `%lum HUE DELTA` — adjust luminance of pixels near HUE by DELTA
- `%desat HUE` — desaturate pixels near the given hue
- `%repeat SOURCE TARGET` — reuse a previous tile definition with current color transforms
- `%resetcol` — reset color transforms
- `%start / %compose / %finish` — composite multiple source tiles into one output tile
- `%rim 0/1` — control whether the build tool adds a black outline
- `%domino N` — tag tile with a domino variant index (for Crypt floor tiling)

This format is a spritesheet packer + code generator in one. It automates the tedious work
of maintaining enum values, variant counts, weight tables, and tilesheet coordinates. The
color variation system (`%hue`/`%lum`/`%desat`) is particularly clever — it generates
15 color variants of a wall type from a single set of source PNGs.

**Could we adapt this approach?** The concept is excellent but the tool is tightly coupled
to DCSS's C++ build system. For our TypeScript port, an equivalent would be a build script
that:
1. Reads a tile definition file (JSON or YAML, not a custom DSL)
2. Packs individual tile PNGs into a tilesheet
3. Generates a TypeScript enum + variant metadata (counts, weights, tilesheet coordinates)
4. Optionally generates color variants via canvas-based hue/lum transforms

This is essentially what our planned art pipeline (Initiative 8) would include.

**G. Confirmed limitations and differences from preliminary scan**

- **No bitmask autotiling for walls/floors.** The preliminary scan suggested `tileview.cc`
  contained "autotiling logic." In practice, it's weighted random variant selection, not
  adjacency-based tile selection. The only bitmask-style logic is for web traps (4-bit
  cardinal neighbors) and floor halos (9-tile directional system). Walls and floors use
  static random variants, not edge-aware tiles.
- **No per-pixel tinting at render time.** All color is baked into tile PNGs at build time
  (via the `%hue`/`%lum`/`%desat` system) or selected from pre-colored variants. DCSS
  does not multiply-tint sprites with game colors the way BrogueCE does. This is a
  fundamental difference — Brogue's per-cell lighting system requires runtime tinting.
- **Simpler layer model than expected.** 3 layers (bg/fg/cloud) + flag bits + overlays,
  not the deep compositing stack we anticipated.
- **`tilepick.cc` exists and is large (5179 lines).** The PLAN.md open question is
  resolved: tile selection logic is split between `tileview.cc` (flavour initialization,
  floor halos, animation) and `tilepick.cc` (all feature/monster/item → tile mapping).
  `tilepick-p.cc` (1235 lines) handles player doll tile selection separately.

#### 3.3. Cataclysm: DDA tileset system

- **Link:** https://github.com/CleverRaven/Cataclysm-DDA
- **Docs:** https://docs.cataclysmdda.org/TILESET.html,
  https://i-am-erk.github.io/CDDA-Tilesets/how-to/autotiles.html
- **Problem it solves:** JSON-driven tile definitions, rotation, adjacency-aware tiles,
  layer compositing
- **Relevance:** **Deep-dive** — the best-documented autotile/multitile system in any open
  source roguelike. The JSON format and tooling are directly informative.
- **Status:** Deep-dive complete

##### Deep-dive findings

**A. Multitile/autotile selection algorithm — the core of CDDA's system**

CDDA uses a **4-bit cardinal bitmask** system, not the 8-bit blob system. Only the four
cardinal neighbors (N/S/E/W) are checked — diagonal neighbors are ignored entirely. This
produces 16 possible connection states (2^4), mapped to 6 named subtile types:

| Bitmask value | Subtile type | Rotation | Description |
|---------------|-------------|----------|-------------|
| `0` (0000) | `unconnected` | 0 | No neighbors connected |
| `1` (0001) | `end_piece` | 0 | Connected only to south |
| `2` (0010) | `end_piece` | 1 | Connected only to east |
| `3` (0011) | `corner` | 0 | Connected S+E |
| `4` (0100) | `end_piece` | 3 | Connected only to west |
| `5` (0101) | `corner` | 3 | Connected S+W |
| `6` (0110) | `edge` | 1 | Connected E+W (horizontal) |
| `7` (0111) | `t_connection` | 0 | Connected S+E+W |
| `8` (1000) | `end_piece` | 2 | Connected only to north |
| `9` (1001) | `edge` | 0 | Connected N+S (vertical) |
| `10` (1010) | `corner` | 1 | Connected N+E |
| `11` (1011) | `t_connection` | 1 | Connected N+S+E |
| `12` (1100) | `corner` | 2 | Connected N+W |
| `13` (1101) | `t_connection` | 3 | Connected N+S+W |
| `14` (1110) | `t_connection` | 2 | Connected N+E+W |
| `15` (1111) | `center` | 0 | All four neighbors connected |

The algorithm lives in `get_rotation_and_subtile()` (`cata_tiles.cpp` line 5016) — a single
`switch(val)` on the 4-bit connection value. Each case sets `subtile` (which named sprite
to use) and `rotation` (which rotation variant of that sprite). The rotation value selects
from the pre-rotated sprite array in the tileset JSON, or triggers SDL `RenderCopyEx`
rotation at draw time (90°/180°/270° or horizontal flip).

Neighbor lookup is straightforward: check the 4 cardinal neighbors against the same tile
type (`neighborhood[i] == tid` for simple same-type matching) or against a connect_group
bitset (`connect_group.any()` path via `map::get_known_connections()`).

The 6 subtile types produce a total of **16 unique visuals** from just **6 authored sprite
sets** (where each set has 1, 2, or 4 rotation variants):
- `center`: 1 sprite (no rotation needed)
- `corner`: 4 rotation variants (NW, SW, SE, NE)
- `t_connection`: 4 rotation variants (N, W, S, E)
- `edge`: 2 rotation variants (N-S vertical, E-W horizontal)
- `end_piece`: 4 rotation variants (N, W, S, E)
- `unconnected`: 1–2 sprites (or up to 16 for `rotates_to` furniture)

**B. connect_groups vs. raw bitmask — the connection model**

CDDA separates connection logic into two orthogonal systems defined on the **terrain/furniture
object** (not in the tileset):

1. **`connect_groups`**: Declares which connection groups a terrain/furniture type belongs to.
   A brick wall might be in group `"WALL"`. These are bitset-based — each group is a bit in a
   `std::bitset<NUM_TERCONN>`.

2. **`connects_to`**: Declares which groups this type visually connects to. A brick wall
   `connects_to: "WALL"` means it connects to any terrain in the `WALL` group — including
   other wall types like wood walls, metal walls, etc.

The key insight: **connections are asymmetric and group-based, not identity-based.**
`get_connect_values()` checks each cardinal neighbor's `connect_to_groups` bitset against
the current tile's `connect_to_groups` — if any bits overlap, they're connected. This means:
- A brick wall connects to a wood wall (both in `WALL` group) without needing any special
  brick-to-wood transition sprites
- Doors automatically connect to walls (doors are in the `WALL` group)
- Windows connect to walls (via `CONNECT_WITH_WALL` flag)

For tiles without `connect_groups`, CDDA falls back to `get_terrain_orientation()` which
does **same-type matching** — the simpler `neighborhood[i] == tid` check. The
`NO_SELF_CONNECT` flag disables this for furniture that should never self-connect.

There's also a third mechanism: **`rotates_to`** — a separate group-based system for tiles
that should orient *toward* neighboring features rather than *connect* to them. Street lights
rotate to face the pavement; doors rotate to show inside vs. outside. `rotates_to` modifies
the rotation of `edge`, `end_piece`, and `unconnected` subtiles but doesn't change the
subtile type itself.

**Relevance to our system:** The connect_groups concept is directly applicable to Brogue.
We have cases where different terrain types should visually connect:
- All wall types (granite, dungeon, crystal) should connect to each other
- Doors should connect to walls
- Deep water should connect to shallow water
- Lava should connect to brimstone

A simple identity-based bitmask (connect only to same type) wouldn't handle these cases.
We should adopt a group-based system, though we don't need the full complexity of CDDA's
bitset approach — a string-based group map would suffice for Brogue's ~40 terrain types.

**C. Multitile fallbacks — graceful degradation**

When `draw_from_id_string_internal()` is called with a multitile tile and a subtile index,
it tries to find a subtile sprite by appending the subtile key to the tile ID
(e.g., `t_wall_w_center`). The fallback chain:

1. Look for the multitile subtile variant (`id + "_" + multitile_keys[subtile]`)
2. If not found, fall back to the base tile (the root `fg` sprite)
3. If base tile not found, try `looks_like` chain (one tile can declare it looks like another)
4. If still nothing, try ASCII tile fallback (generate a tile from the Unicode symbol + colors)
5. Final fallback: the `unknown` tile (bright magenta square)

This means a tileset can define a partial multitile (e.g., only `corner` and `edge`) and
everything else falls back to the base sprite. A tileset that hasn't implemented multitile
at all still works — every tile renders as its base sprite with no connections.

**D. Draw layer ordering — CDDA's 11-layer model**

The `draw()` function iterates through a fixed array of 11 drawing layer functions, called
in order for each cell (`cata_tiles.cpp` line 1763):

| Order | Layer function | Content |
|-------|---------------|---------|
| 1 | `draw_terrain` | Base terrain (floor, wall, road, etc.) |
| 2 | `draw_furniture` | Furniture on top of terrain (desk, counter, etc.) |
| 3 | `draw_graffiti` | Graffiti painted on surfaces |
| 4 | `draw_trap` | Traps (bear trap, land mine, etc.) |
| 5 | `draw_part_con` | Partial constructions in progress |
| 6 | `draw_field_or_item` | Fields (fire, smoke, acid) and items on the ground |
| 7 | `draw_vpart_no_roof` | Vehicle parts without roof (wheels, frames) |
| 8 | `draw_vpart_roof` | Vehicle roof parts |
| 9 | `draw_critter_at` | Monsters, NPCs, player character |
| 10 | `draw_zone_mark` | Zone markers (loot zones, no-auto-pickup, etc.) |
| 11 | `draw_zombie_revival_indicators` | Revival indicators on corpses |

Each layer function draws via `draw_from_id_string()` → `draw_tile_at()` which itself
does two sub-passes: **bg sprite first, then fg sprite** (each `tile_type` has both a `bg`
and `fg` weighted sprite list). All drawing uses standard alpha compositing via
`SDL_RenderCopyEx` — no multiply, no additive blending, no special blend modes for
individual layers.

Additionally, **color block overlays** are drawn *after* all tile layers, using a
configurable `SDL_BlendMode` (typically `SDL_BLENDMODE_BLEND` for semi-transparent
colored rectangles). These handle highlighting, selection UI, etc.

**Comparison with our proposed 11-layer stack:** CDDA's 11 layers are strikingly similar
in count to our proposal, though the *content* differs because CDDA has vehicles, partial
constructions, and zones that Brogue doesn't. Our layer needs map roughly to:

| Our proposed layer | CDDA equivalent |
|-------------------|-----------------|
| 1. Background terrain | `draw_terrain` |
| 2. Terrain feature | `draw_furniture` / `draw_trap` |
| 3. Surface effect | `draw_field_or_item` (fields) |
| 4. Item | `draw_field_or_item` (items) |
| 5. Entity | `draw_critter_at` |
| 6. Gas/cloud | `draw_field_or_item` (fire, smoke) |
| 7. Liquid animation | (no equivalent — CDDA water is just terrain) |
| 8. Lighting | Pre-baked texture variants (shadow/night/overexposed) |
| 9. Status effect | Entity overlays (drawn inside `draw_critter_at`) |
| 10. Bolt/projectile | `draw_bullet` / `draw_hit` (transient overlays) |
| 11. UI overlay | Color block overlays + `draw_zone_mark` |

CDDA validates that 11-ish layers is a reasonable count for a complex roguelike. However,
CDDA doesn't need a runtime multiply-tint pass (our layer 8) because it pre-generates
shadow/night/overexposed texture variants at load time.

**E. `layering.json` — context-sensitive item/field rendering**

`layering.json` is *not* a general layer ordering system. It's a narrower feature: it
defines **context-sensitive sprite overrides** for items and fields placed on specific
furniture/terrain. For example:
- A laptop on a desk (`f_desk`) uses `desk_laptop` sprite instead of the generic laptop
- A fire on a desk uses `desk_fd_fire` sprite instead of the generic fire
- Items on a desk have a `layer` integer (1-100) controlling intra-layer draw order

Each entry has: `context` (furniture/terrain ID or flag), `item_variants` (array of
item→sprite mappings with layer ordering, offsets, and weighted sprite variants), and
`field_variants` (similar for fields).

This is essentially a "looks different on furniture" system, not the layer-ordering
mechanism we expected. For our system, this maps to a simpler concept: terrain-aware
sprite overrides (e.g., a torch on a wall vs. a torch on the floor could use different
sprites). Not a priority for our current pipeline.

**F. Lighting/tinting model — pre-baked texture variants**

CDDA does **not** do per-pixel color tinting at render time. Instead, at tileset load time,
it generates 5 complete copies of every tile texture:

| Variant | Color filter | Used when |
|---------|-------------|-----------|
| `tile_values` | None (original colors) | Normal lit tiles |
| `shadow_tile_values` | Grayscale | `lit_level::LOW` |
| `night_tile_values` | Night vision (green tint) | Night vision goggles active + low light |
| `overexposed_tile_values` | Overexposed (washed out) | Night vision goggles + bright light |
| `memory_tile_values` | Configurable (sepia, grayscale) | Previously seen, now out of sight |

The filter functions (`color_pixel_grayscale`, `color_pixel_nightvision`, etc.) are applied
per-pixel during texture loading via `apply_color_filter()` — a CPU-side surface transform
that runs once, producing GPU textures that are then used without any further color
manipulation.

**This is fundamentally incompatible with Brogue's approach.** Brogue has per-cell
foreground and background RGB colors that vary continuously based on light sources, torch
flicker, status effects, and fog of war. We need runtime tinting, not pre-baked lighting
states. CDDA can get away with this because its lighting model is discrete (lit/dim/dark/
memorized), not the continuous RGB gradient that Brogue uses.

**G. Creature facing direction — CDDA does it**

CDDA implements **2-directional creature facing** (left/right), confirming this is a
standard approach for tile-based roguelikes:

```cpp
int rot_facing = -2;
if( m->facing == FacingDirection::RIGHT ) {
    rot_facing = 0;
} else if( m->facing == FacingDirection::LEFT ) {
    rot_facing = -1;  // triggers SDL_FLIP_HORIZONTAL
}
```

Monsters store a `facing` field (`FacingDirection::LEFT` or `FacingDirection::RIGHT`).
When drawing, `rot_facing = -1` triggers `SDL_FLIP_HORIZONTAL` in `draw_sprite_at()`,
mirroring the sprite. `rot_facing = 0` draws normally (facing right is the default).

Characters (player, NPCs) are drawn via `draw_entity_with_overlays()` which composites
the base sprite with equipment overlays, wielded weapon, mutations, and status effects.
The character facing is passed to this function and affects the base sprite orientation.

**Relevance to our system:** CDDA's approach matches our proposed 2-directional plan
exactly. One sprite per creature, mirrored via canvas `scale(-1, 1)` for left-facing.
This validates our approach:
- Default facing: right (convention matches DCSS and CDDA)
- Left movement: horizontal flip
- Vertical movement: retain last horizontal facing
- Spawned creatures: default facing based on context or random

Combined with DCSS (which has no facing at all), the evidence strongly supports
2-directional as the right choice — even the most feature-rich open-source roguelike
tile system only does left/right.

**H. Rotation and sprite selection mechanics**

CDDA handles rotation in two ways, selectable per-tile:

1. **Pre-rotated sprites** (rotation selects from sprite array):
   When `fg` is an array like `[sprite_n, sprite_w, sprite_s, sprite_e]`, the rotation
   value indexes into the array: `sprite_num = rota % spritelist.size()`. This is used
   for multitile subtiles — corner tiles have 4 pre-drawn variants for each orientation.

2. **SDL rotation** (single sprite, runtime transform):
   When `fg` is a single sprite and `rotates: true`, SDL applies the rotation: 90°, 180°
   (via double flip), or 270° via `SDL_RenderCopyEx`. Also used for creature facing with
   `SDL_FLIP_HORIZONTAL`.

The multitile JSON format makes this concrete. A full multitile entry for a wall:

```json
{
    "multitile": true,
    "additional_tiles": [
        { "id": "center", "fg": "wall_center" },
        { "id": "corner", "fg": ["wall_nw", "wall_sw", "wall_se", "wall_ne"] },
        { "id": "t_connection", "fg": ["wall_t_n", "wall_t_w", "wall_t_s", "wall_t_e"] },
        { "id": "edge", "fg": ["wall_ns", "wall_ew"] },
        { "id": "end_piece", "fg": ["wall_end_n", "wall_end_w", "wall_end_s", "wall_end_e"] },
        { "id": "unconnected", "fg": ["wall_alone", "wall_alone"] }
    ]
}
```

Total unique sprites needed per terrain type: **1 + 4 + 4 + 2 + 4 + 1 = 16 sprites**
for the full set. This matches the 4x4 autotile template that `slice_multitile.py`
generates from. Many tilesets define fewer (e.g., omitting `unconnected` or `end_piece`)
and rely on fallback to the base sprite.

**I. Tile lookup and the `looks_like` chain**

CDDA has a powerful fallback system via `looks_like` declarations on terrain/furniture
definitions. When a specific tile sprite isn't found, `find_tile_looks_like()` follows a
chain: `t_brick_wall` → `t_wall` → `t_wall_half` → `unknown`. This allows tilesets to
define sprites at any level of specificity — a tileset can define one generic wall sprite
and all wall subtypes automatically use it.

This is relevant for our tileset architecture: we could define sprite overrides at the
TileType level (specific) or at the DisplayGlyph level (generic), with automatic fallback.

**J. Confirmed findings vs. preliminary scan**

- **4-bit cardinal, not 8-bit blob.** CDDA uses only 4 cardinal neighbors (16 combinations),
  not 8-neighbor blob tiles (256/47 combinations). This produces visually clean results but
  cannot distinguish inner corners from outer corners — a diagonal neighbor touching a
  corner doesn't produce a different tile. For Brogue's relatively simple terrain (walls,
  floors, water, lava), 4-bit cardinal is likely sufficient and much simpler to implement
  and author sprites for.
- **No runtime per-pixel tinting.** Like DCSS, CDDA bakes lighting into pre-generated
  texture variants. Neither project has Brogue's continuous per-cell RGB lighting. We're
  on our own for the tinting model.
- **11 draw layers, matching our proposal count.** CDDA's 11-layer model validates our
  proposed layer count, though the specific layers differ (CDDA has vehicles/constructions;
  we need lighting tint and liquid animation).
- **Creature facing exists.** CDDA implements 2-directional left/right facing via
  `FacingDirection` enum and `SDL_FLIP_HORIZONTAL`, exactly as we proposed.
- **`layering.json` is narrower than expected.** Not a general layer-ordering system, but
  context-sensitive sprite overrides for items on specific furniture.
- **The tile pipeline tooling is mature.** `compose.py` (spritesheet packing) and
  `slice_multitile.py` (template slicing) form a production-quality art pipeline. The
  template approach (author a 4x4 grid, slice into 16 named sprites + JSON) is directly
  adoptable for our art pipeline initiative.

### Reference Tier: Useful Documentation, No Source Dive Needed

These provide well-documented algorithms or approaches we can learn from without cloning.

#### 3.4. Godot TileMap / Terrains

- **Link:** https://docs.godotengine.org/en/4.5/tutorials/2d/using_tilesets.html
- **Problem it solves:** Well-documented autotiling algorithms (bitmask, blob, peering bits)
- **Relevance:** **Reference only** — Godot's documentation is the clearest explanation of
  the algorithms. We wouldn't use Godot code, but the algorithm descriptions are canonical.
- **Preliminary findings:**
  - **Godot 4 "Terrains" system:** Replaces Godot 3 "Autotile." Uses "Peering Bits" in a
    3x3 grid: surrounding 8 squares define adjacent terrain, center defines own terrain.
  - **Two modes:** "Match Corners and Sides" (8-neighbor, 47 unique tiles — the blob/Wang
    approach) and "Match Sides" (4-neighbor, 16 tiles — simpler cardinal approach).
  - **47-tile blob format:** Considers all 8 neighbors (256 combinations) but only 47
    visually distinct tile shapes are needed. Industry standard. Produces the smoothest
    transitions with proper inner corners and diagonal handling.
  - **16-tile cardinal format:** Only considers N/S/E/W (16 combinations). Blockier results,
    no inner corners, but much easier to draw and implement.
- **Decision input:** The 47-tile blob format is the clear winner for quality. The 16-tile
  format could be a viable first step (get something working, upgrade later).
- **Status:** Complete (documentation reviewed — no source dive needed)

#### 3.5. Excalibur.js Autotiling Blog Post + Demo

- **Link (article):** https://excaliburjs.com/blog/Autotiling%20Technique/
- **Link (demo source):** https://github.com/jyoung4242/CA-itchdemo
- **Problem it solves:** Complete TypeScript implementation of 8-bit bitmask autotiling
  with Wang blob tiles
- **Relevance:** **Reference only** — the most directly applicable code reference. TypeScript,
  Canvas2D, complete working implementation with source code.
- **Preliminary findings:**
  - **Full implementation walkthrough:** The article covers bitmask encoding, neighbor
    lookup, Wang tile mapping, and rendering — all in TypeScript.
  - **Algorithm:** For each tile, encode 8 neighbors as bits (1=solid, 0=not). The resulting
    0-255 value maps to a coordinate in a 47-tile Wang blob spritesheet via a
    `Record<number, [x, y]>` lookup table.
  - **Key code patterns:**
    - `neighborOffsets` array: `[[1,1], [0,1], [-1,1], [1,0], [-1,0], [1,-1], [0,-1], [-1,-1]]`
    - `_getBitmask()`: loops neighbors, `bitmask |= 1 << i` for solid neighbors
    - Out-of-bounds cells treated as solid (configurable)
    - Floor drawn first, then wall sprite on top (two-layer approach)
  - **The tedious part:** Manually mapping all 256 bitmask values to one of 47 tile sprites.
    The article author did this by trial and error. Some bitmask values map to the same
    tile (e.g., bitmask 0, 1, 4, 128, 32 all map to the same "isolated" tile).
  - **Directly reusable:** The bitmask computation and lookup table approach could be
    transplanted into our `SpriteRenderer` almost verbatim.
- **Status:** Complete (reviewed — the article IS the source dive)

#### 3.6. `autotile` npm package (node-autotile)

- **Link:** https://github.com/tlhunter/node-autotile / https://www.npmjs.com/package/autotile
- **Problem it solves:** Standalone 8-bit bitmask autotile computation
- **Relevance:** **Reference only** — too limited to use directly, but confirms the algorithm.
- **Preliminary findings:**
  - 8-bit cornered bitmask approach. Takes 2D array of truthy/falsey, returns tile offset
    indices. Zero dependencies.
  - **Limitations:** Only binary terrain (wall/floor). No multi-terrain support. Last
    updated 2017. ~2 downloads/week. Planned 4-bit mode never implemented.
  - **Verdict:** Too simple and unmaintained to depend on. The algorithm is the same as
    Excalibur.js (above) which has a better explanation. We'd implement our own.
- **Status:** Complete (not worth further investigation)

#### 3.7. Caves of Qud tile system

- **Link:** Not open source. Modding wiki: https://wiki.cavesofqud.com/wiki/Modding:Tiles
- **Problem it solves:** Rich layered rendering, 3-color tile system, adjacency-aware walls
- **Relevance:** **Reference only** — interesting design choices but closed-source limits depth.
- **Preliminary findings:**
  - **3-color tile system:** Black non-transparent pixels → foreground color. White
    non-transparent → detail color. Transparent → background color. Optional 4th color
    (RGBA 124,101,44,255) creates a weighted foreground/detail blend.
  - **Truecolor mode:** Mods can use `shadermode: "1"` to render tiles with natural colors
    + background color blend, bypassing the 3-color system.
  - **Wave Function Collapse:** Used for procedural map generation (not tile rendering).
    Adjacency constraints define which tiles can be neighbors — more powerful than Wang
    tiles for generation, but a different problem than display-time autotiling.
  - **No source access:** Can't study the actual rendering code or autotile implementation.
- **Useful insight:** The 3-color system is a middle ground between our "colored sprites +
  multiply tint" and C BrogueCE's "white sprites + color mod." It preserves some sprite
  character while allowing color control. Worth considering for our art pipeline decisions.
- **Status:** Complete (documentation reviewed — no source available)

### Skip Tier

#### 3.8. rot.js

- **Link:** https://github.com/ondras/rot.js
- **Problem it solves:** TypeScript roguelike toolkit with tile rendering
- **Relevance:** **Skip** — the tile display is too simple to inform our design.
- **Preliminary findings:**
  - TypeScript library with Canvas2D + WebGL display backends. Well-built for ASCII
    roguelikes. Tile display (`src/display/tile.ts`) is ~80 lines.
  - **Tile rendering:** Draws sprites from a tileset at grid positions. Optional colorization
    via `globalCompositeOperation` (same approach as our prototype). Supports drawing
    multiple characters/sprites per cell as layers.
  - **No autotiling, no adjacency, no compositing model, no creature facing.** The tile
    display is a thin grid-to-sprite mapper.
  - The colorization approach (offscreen canvas + composite op) is the same pattern we
    already use. Nothing new to learn here.
- **Status:** Complete (not worth further investigation)

#### 3.9. UnBrogue / Brogue forks (gBrogue, BrogueTiles, kBrogue)

- **Link:** https://github.com/gbelo/gBrogue, https://github.com/dethmuffin/BrogueTiles
- **Problem it solves:** Same game, different tile approaches
- **Relevance:** **Skip** — no novel tile rendering approaches beyond what BrogueCE `tiles.c`
  already provides.
- **Preliminary findings:**
  - **gBrogue:** Fork of Brogue v1.7.4 (2019). C/C++ mix. No tile-specific innovations
    visible from the repo description.
  - **BrogueTiles:** Contains Brogue source + fonts/resources. No novel rendering.
  - **kBrogue:** Experimental additions to BrogueCE. No tile-specific work.
  - **UnBrogue:** No public GitHub repo found. Available only as compiled binaries for
    Mac/Windows. Gameplay changes only (weapons, armor, wands), not rendering.
- **Status:** Complete (not worth further investigation)

### New Candidates (discovered during research)

#### 3.10. BrogueCE Issue #332 — Adjacency Tiles Proposal

- **Link:** https://github.com/tmewett/BrogueCE/issues/332
- **Problem it solves:** Exactly our autotiling problem, proposed for BrogueCE itself
- **Relevance:** **Reference only** — essential context for our design decisions.
- **Preliminary findings:**
  - Opened by @pender (BrogueCE contributor) in 2021. Still open.
  - Proposes extending the current wall-top logic (which already selects `G_WALL_TOP` based
    on the cell below) to use 4 or 8 adjacent tiles for tile selection.
  - **Includes visual examples:** 8-bit blob template (6 tilesets showing all edge types),
    and a simpler 4-bit cardinal template (16 tiles as binary bitmap of 4 neighbors).
  - Quote: "I think an approach like this could be a good way to level up the appearance
    of obstruction and liquid tiles in particular."
  - Labeled `enhancement` by @tmewett (maintainer) in 2023.
  - **Directly validates our approach.** The BrogueCE community has already identified this
    as the right direction, with the same algorithm options we're considering.
- **Status:** Complete (issue reviewed)

#### 3.11. Excalibur.js CA Autotile Demo (TypeScript reference implementation)

- **Link:** https://github.com/jyoung4242/CA-itchdemo
- **Problem it solves:** Working TypeScript autotile implementation with demo
- **Relevance:** **Reference only** — could be cloned to study if the blog post (3.5) isn't
  sufficient, but the blog post covers the code thoroughly.
- **Status:** Queued as optional supplement to 3.5

#### 3.12. `phaser3-autotile` (Phaser 3 autotile plugin)

- **Link:** https://github.com/browndragon/phaser3-autotile
- **Problem it solves:** Wang blob tile generation and autotiling within Phaser 3
- **Relevance:** **Skip** — tied to Phaser framework, last updated 2023. Algorithm is same
  as Excalibur.js reference. No new information.
- **Status:** Complete (not worth further investigation)

#### 3.13. LDtk Level Designer

- **Link:** https://ldtk.io/docs/general/auto-layers/auto-layer-rules
- **Problem it solves:** Visual autotile rule editor with JSON export
- **Relevance:** **Reference only** — the rules assistant and auto-layer system design
  could inform a future tile editor or rule-based tile selection system.
- **Preliminary findings:**
  - Auto-layer rules use grid patterns to determine tile placement. Rules check neighboring
    cells and paint specific tiles when patterns match.
  - v1.2.0 added a Rules Assistant that auto-generates rules from template layouts,
    including symmetrical rules for missing orientations.
  - JSON export with TypeScript type generation via QuickType.
  - More relevant to our art pipeline (Initiative 8) than to the runtime renderer.
- **Status:** Complete (documentation reviewed)

#### 3.14. Flare Engine

- **Link:** https://github.com/flareteam/flare-engine
- **Problem it solves:** Multi-layer tile rendering, fog of war, isometric support
- **Relevance:** **Skip** — it's a full C++ SDL2 engine for action RPGs. The layer model
  is interesting but the codebase is too large and too different from our browser Canvas2D
  context to justify a deep-dive. The same concepts are better studied in DCSS or CDDA.
- **Status:** Complete (not worth further investigation)

### 3.S. Synthesis and Recommendations

> Cross-referencing all findings from Sections 3.1–3.14 into concrete design decisions
> for the BrogueCE pixel art system.

#### Autotiling: 8-bit blob (47 tiles) with connection groups

**Decision:** Use the **8-bit blob / Wang blob** autotiling algorithm (47 unique tile shapes
per terrain type). Adopt CDDA-style **connection groups** for cross-type neighbor matching.

**Algorithm:** For each cell, encode 8 neighbors as a bitmask (N/NE/E/SE/S/SW/W/NW, bits
0-7). Map the resulting 0-255 value to one of 47 tile variants via a
`Record<number, SpriteVariant>` lookup table. The Excalibur.js reference (Section 3.5) has
a complete TypeScript implementation of this, including the 256-entry lookup table and the
`_getBitmask()` function. The Red Blob Games article explains the quarter-tile decomposition
that makes 47 tiles sufficient to cover all 256 cases.

**Why 8-bit over 4-bit:** CDDA chose 4-bit cardinal (Section 3.3) and it works well for
their game. But Brogue's dungeon layouts are more visually dense — cavern walls with many
diagonal adjacencies — where the lack of inner corner distinction would be visible. RPG
Maker, Godot, Celeste, and Stardew Valley all use the 47-tile approach. The code complexity
difference is minimal (the bitmask computation adds 4 diagonal checks); the main cost is
the art burden (47 vs. 16 authored sprites per terrain type). For Brogue's ~6-8 connectable
terrain types, this is manageable (~280-370 total autotile sprites).

**Connection groups (from CDDA, Section 3.3B):** Neighbor matching should be group-based,
not identity-based. Define a `ConnectionGroup` map:

```typescript
const CONNECTION_GROUPS: Record<string, TileType[]> = {
  WALL: [TileType.GRANITE, TileType.DUNGEON_WALL, TileType.CRYSTAL_WALL,
         TileType.TORCH_WALL, TileType.CLOSED_DOOR, TileType.OPEN_DOOR, ...],
  WATER: [TileType.DEEP_WATER, TileType.SHALLOW_WATER],
  LAVA: [TileType.LAVA, TileType.BRIMSTONE],
  FLOOR: [TileType.FLOOR, TileType.CARPET, TileType.MARBLE_FLOOR],
};
```

A wall cell checks whether each neighbor is in the `WALL` group (not whether it's the exact
same wall type). This handles wall-to-door connections, shallow-to-deep water transitions,
and similar cross-type adjacencies that a simple identity check would miss.

**Where to compute:** Option B — in the sprite renderer, at draw time, reading from `pmap`.
Rationale: Brogue is turn-based; the full 79x29 viewport is only ~2300 cells. Eight neighbor
lookups per cell is ~18,400 lookups per frame — trivial on modern hardware. This avoids
cache invalidation complexity (CDDA's approach of computing at draw time via
`get_connect_values()` confirms this is viable in a production system). If performance is
ever an issue, Option C (cached grid with dirty-flag invalidation) is a clean upgrade path,
but premature optimization here.

**Reference projects informing this decision:**
- Excalibur.js (3.5): TypeScript bitmask algorithm and lookup table
- Godot (3.4): Algorithm documentation, 47-tile "Match Corners and Sides" mode
- CDDA (3.3): connection groups concept, draw-time computation pattern
- BrogueCE Issue #332 (3.10): validates this direction for BrogueCE specifically

#### Layer compositing: 11 layers, validated

**Decision:** Keep the proposed 11-layer stack from Section 4d. Both DCSS (3 stored layers +
flags + overlays ≈ 7 effective layers) and CDDA (11 explicit draw layers) validate that
production roguelikes use this order of magnitude.

**Revised layer stack** (incorporating research findings):

| Layer | Content | Compositing | Source |
|-------|---------|-------------|--------|
| 1. Background terrain | Floor, grass, water surface | Opaque fill + sprite | All three references |
| 2. Terrain feature | Door, stairs, trap, altar | Alpha over bg | CDDA `draw_furniture`/`draw_trap` |
| 3. Surface effect | Foliage, fungus, cobweb, blood | Alpha overlay | CDDA `draw_field_or_item` (fields) |
| 4. Item | Weapon, potion, scroll on ground | Alpha over terrain | CDDA `draw_field_or_item` (items) |
| 5. Entity | Player, monster | Alpha over terrain | CDDA `draw_critter_at` |
| 6. Gas / cloud | Confusion gas, steam, poison | Semi-transparent alpha | DCSS `bk_cloud` layer |
| 7. Lighting tint | Per-cell fg/bg color tinting | Multiply over all below | Unique to Brogue (no reference) |
| 8. Status effect | On-fire, entranced, paralyzed | Additive/screen on entity | CDDA entity overlays |
| 9. Bolt / projectile | Zap trail, thrown item arc | Alpha with glow | CDDA `draw_bullet`/`draw_hit` |
| 10. Liquid animation | Water shimmer, lava glow | Animated overlay on L1 | No reference (Brogue-specific) |
| 11. UI overlay | Cursor, path preview, targeting | Colored overlay | CDDA color blocks + zones |

**Key change from original proposal:** Lighting (layer 7) moved below status effects and
bolts. This is intentional — status effects and bolts should render at full brightness
regardless of cell lighting, the same way the ASCII renderer shows them. Lighting tints
layers 1-6 (terrain through gas) but not 8-11.

**Layer 7 (lighting) is our unique challenge.** Neither DCSS nor CDDA does runtime per-pixel
tinting. DCSS bakes color into tiles at build time via `%hue`/`%lum`/`%desat` (Section
3.2F). CDDA pre-generates grayscale/night/overexposed texture copies at load time (Section
3.3F). Brogue's continuous per-cell RGB lighting is architecturally distinct from both
projects. Our current prototype approach (offscreen canvas + `multiply` composite +
`destination-in` alpha restore per sprite) works but is expensive for multi-layer cells.
This is the area most likely to need a WebGL upgrade if Canvas2D performance is
insufficient.

#### Creature facing: 2-directional (left/right flip)

**Decision:** 2-directional facing via horizontal sprite flip.

**Evidence:** CDDA implements exactly this — `FacingDirection::LEFT`/`RIGHT` with
`SDL_FLIP_HORIZONTAL` (Section 3.3G). DCSS has no creature facing at all (Section 3.2D).
No open-source roguelike we studied implements 4-directional creature sprites. Our Canvas2D
equivalent is `ctx.scale(-1, 1)` before drawing.

**Implementation:**
- Add `lastMoveDir: number` to `Creature` (set during movement)
- Derive facing from horizontal component: dirs 1,2,3 → right; dirs 5,6,7 → left;
  dirs 0,4 (pure N/S) → retain previous facing
- Default facing for newly spawned creatures: right (matching DCSS/CDDA convention)
- Sprite renderer applies horizontal flip when facing === left

#### Tinting strategy: white/grayscale sprites for production art

**Decision:** Production art pipeline should target **white/grayscale sprites** (the
BrogueCE C tiles.c approach, Section 3.1A). Continue using colored DawnLike sprites as
development placeholders.

**Rationale:** Brogue's color system is not cosmetic — it encodes gameplay information.
Light sources, terrain types, status effects, and fog of war all express through per-cell
color. White sprites let the game's colors show exactly as intended (white × color = color).
Colored sprites fight the tinting (multiply can muddy bright colors, producing unintended
hues).

The **Caves of Qud 3-color system** (Section 3.7) is worth prototyping as an alternative:
black pixels → foreground color, white pixels → detail color, transparent → background.
This preserves some artistic control (two-tone sprites with a detail accent) while still
responding to game coloring. Recommendation: prototype both approaches in the art pipeline
initiative and compare results on 3-4 representative terrain/creature sprites before
committing.

**What we can rule out:** Runtime-free tinting like DCSS (`%hue`/`%lum`/`%desat` at build
time, Section 3.2F) and CDDA (pre-baked texture variants, Section 3.3F). Both are
incompatible with Brogue's continuous per-cell lighting model.

#### Architecture patterns: SpriteRenderer design

**Decision:** Adopt a layered rendering architecture inspired by CDDA's draw function
pattern, adapted for Canvas2D.

**Pattern from CDDA (Section 3.3D):** The `draw()` function iterates a fixed array of
layer-drawing functions. Each function receives the cell position and draws one layer via
`draw_from_id_string()` → `draw_tile_at()` (bg sprite, then fg sprite). This is clean,
extensible (add a layer = add a function to the array), and avoids the deep switch/if
branching of our current `plotChar`.

**Proposed `SpriteRenderer` interface:**

```typescript
interface SpriteRenderer {
  drawCell(x: number, y: number, cell: CellRenderData): void;
}

interface CellRenderData {
  bg: Color;
  fg: Color;
  terrain: TileType;
  feature?: TileType;        // door, stairs, trap
  surface?: TileType;        // foliage, fungus
  item?: DisplayGlyph;       // item on ground
  entity?: DisplayGlyph;     // creature/player
  entityFacing?: Facing;     // LEFT or RIGHT
  gas?: { type: TileType; volume: number };
  adjacencyMask?: number;    // 8-bit bitmask for autotiling
  connectionGroup?: string;  // which group this terrain belongs to
}
```

**Tile lookup fallback chain (from CDDA, Section 3.3I):** When looking up a sprite:
1. Try `TileType` → sprite (most specific, terrain-aware)
2. Try `DisplayGlyph` → sprite (generic glyph mapping)
3. Fall back to text rendering (`fillText`) for unmapped glyphs

This matches our current two-tier lookup (`tileTypeSpriteMap` first, `spriteMap` second)
and is validated by CDDA's `looks_like` fallback chain.

#### Libraries, tools, and code to adapt

| Resource | From | What to use | Initiative |
|----------|------|------------|------------|
| 8-bit bitmask algorithm + 256→47 lookup table | Excalibur.js (3.5) | Transplant into autotile system | Initiative 3 |
| Connection group concept | CDDA (3.3B) | Implement as `ConnectionGroup` map | Initiative 3 |
| 4x4 autotile template format | CDDA `slice_multitile.py` (3.3H) | Adapt for our art pipeline | Initiative 8 |
| Progressive integer-division cell sizing | tiles.c (3.1C) | `cellX = x * canvasWidth / COLS` | Initiative 1 |
| `destination-in` alpha restore after multiply | Our prototype (Section 2) | Keep as-is | Already done |
| `%hue`/`%lum`/`%desat` build-time transforms | DCSS rltiles (3.2F) | Adapt as optional tilesheet color variant generator | Initiative 8 |

**Tools we should NOT adopt:**
- DCSS's custom `.txt` tile definition DSL — too coupled to C++ build. Use JSON/YAML instead.
- CDDA's `compose.py` directly — too CDDA-specific. Write our own spritesheet packer that
  understands our tileset format.
- Any of the npm autotile packages (3.6) — too limited. Our own implementation is trivial
  and more flexible.

---

## 4. Technical Challenges

### 4a. Tile Adjacency / Autotiling

**The problem:** Tiles like ground and walls currently have no concept of their neighbors.
A floor tile next to a wall looks the same as one surrounded by other floor tiles. Walls
that open to ground on the bottom look the same as walls surrounded by more wall. For
quality pixel art, we need variant sprites: wall-bottom-edge, wall-corner, floor-edge,
floor-interior, etc.

**Current state:**
- No adjacency information stored per-cell
- The `pmap` grid is always available — neighbors can be looked up via `nbDirs` / `cDirs`
  direction tables and `coordinatesAreInMap()` bounds checking
- Dungeon generation uses neighbor checks transiently (e.g., `finishWalls` in
  `architect/lakes.ts` converts granite to wall if any neighbor is non-obstructing) but
  never stores adjacency data on the cell
- The display pipeline already has a limited form: `getCellAppearance` changes `G_WALL` to
  `G_WALL_TOP` when the cell below is also wall-like

**Standard approaches:**
- **4-bit cardinal bitmask** (N/S/E/W): 16 possible combinations, 16 sprite variants per
  tile type. Simple but can't distinguish corners.
- **8-bit blob bitmask** (N/NE/E/SE/S/SW/W/NW): 256 combinations, reducible to 47 unique
  tile shapes. Handles corners. Industry standard (RPG Maker, Godot).
- **Wang tiles:** Mathematical tiling with edge-matching constraints. More complex, used in
  procedural generation more than rendering.

**Where to compute:**
- Option A: In `getCellAppearance`, adding an `adjacencyMask` field to `CellDisplayBuffer`.
  Pro: computed once per cell per frame. Con: adds complexity to the appearance pipeline.
- Option B: In the sprite renderer, looking up neighbors from `pmap` at draw time. Pro:
  keeps game logic clean. Con: redundant neighbor lookups if multiple cells share edges.
- Option C: Pre-compute a full adjacency grid once per level (or on terrain change), cache
  it. Pro: fastest at render time. Con: cache invalidation when terrain changes (doors
  opening, terrain promoting, lakes flooding).

**Decision made (Section 3.S):** 8-bit blob (47 tiles) with connection groups, computed at
draw time in the renderer.

### 4b. Creature Facing Direction

**The problem:** Creatures and the player have no facing direction. A creature sprite always
shows the same orientation regardless of which way it moved or who it's looking at. For
quality sprites, we want at minimum left/right facing, ideally 4-directional.

**Current state:**
- `Creature` has `loc` (position) but no `facingDir`, `lastMoveDir`, or similar field
- Movement uses direction indices (0-7 via `nbDirs` / `cDirs`) for the move itself but
  discards them after the move completes
- `PlayerCharacter` has no facing field
- `moveMonster()` and player movement code both know the direction at move time

**Proposed approach:**
- Add `lastMoveDir: number` (0-7, matching `nbDirs` index) to the `Creature` interface
- Set it in `moveMonster()` and in the player movement path when a move succeeds
- For idle creatures: retain last move direction; newly spawned creatures default to a
  sensible direction (e.g., toward the nearest exit, or a fixed default)
- Sprite implication: 2-directional (left/right) is the minimum viable — can be achieved
  with a single sprite + horizontal flip. 4-directional (up/down/left/right) is better
  but quadruples art requirements.

**Decision made (Section 3.S):** 2-directional (left/right flip). Validated by CDDA
(implements exactly this) and DCSS (no facing at all).

### 4c. Rendering Architecture Refactor

**The problem:** All rendering logic lives in a single `plotChar()` function in
`browser-renderer.ts` (589 lines total). It has growing if/then branching for text vs.
tile vs. hybrid modes, foreground layers, underlying terrain, and debug flags. The
`drawSpriteTinted` helper is a closure inside `plotChar`. There is no formal `Renderer`
interface — adding new rendering features means making `plotChar` even more complex.

**Current architecture:**
```
createBrowserConsole(options)
  └── plotChar(glyph, x, y, fg, bg, tileType?, underlyingTerrain?)
        ├── if text mode: fillText()
        └── if tile/hybrid mode:
              ├── lookup sprite (TileType first, then DisplayGlyph)
              ├── if underlyingTerrain: drawSpriteTinted(terrain), then drawSpriteTinted(creature)
              ├── if foreground tile: drawSpriteTinted(background), then drawSpriteTinted(foreground)
              ├── else: drawSpriteTinted(sprite)
              └── fallback: fillText() for unmapped glyphs
```

**Proposed architecture:**
```
Renderer (interface)
  ├── TextRenderer implements Renderer
  │     └── plotChar → fillText()
  └── SpriteRenderer implements Renderer
        ├── resolveSprite(glyph, tileType) → SpriteRef
        ├── composeLayers(cell) → [background, terrain, surface, entity, effects, UI]
        └── drawCell(layers) → tinted drawImage per layer
```

**Key considerations:**
- Shared infrastructure (cell sizing, event handling, coordinate mapping, input queue) must
  stay in the console — it's not renderer-specific
- The `Renderer` interface should be minimal: `drawCell(x, y, cellData)` is enough
- Mode switching (`setGraphicsMode`) selects the active renderer instance
- Sprite map data (`glyph-sprite-map.ts`) moves into the sprite renderer or a shared
  sprite registry
- The prototype code in `plotChar` can be extracted mostly intact into `SpriteRenderer`

### 4d. Layer Model and Compositing

**The problem:** The current two-layer draw (background tile + foreground tile, or terrain +
creature) was built ad-hoc for the foreground-tiles initiative. It doesn't account for the
full range of visual layers the game needs: gas clouds, fire effects, lighting overlays,
bolt animations, cursor highlights, items on the ground, etc. Adding more layers without
a model will result in increasingly fragile special-case code.

**Layer enumeration (bottom to top):**

| Layer | Examples | Compositing | Notes |
|-------|----------|-------------|-------|
| 1. Background terrain | Stone floor, grass, carpet, shallow water surface | Opaque fill (or sprite + bg color fill) | Always present |
| 2. Terrain feature | Door, stairs, trap, altar, bridge | Alpha over background | Opaque center, may have edge transparency |
| 3. Surface effect | Foliage, fungus, cobweb, bloodstain, lichen | Alpha over terrain | Transparent overlay; current foreground-tile system |
| 4. Item | Weapon, potion, scroll on ground | Alpha over terrain/surface | Only when no creature present |
| 5. Entity | Player, monster | Alpha over terrain/surface | May have underlyingTerrain already |
| 6. Gas / cloud | Confusion gas, steam, poison, spiderweb | Semi-transparent overlay | Partially obscures entity and terrain |
| 7. Liquid animation | Water shimmer, lava glow | Animated overlay on layer 1 | May need special blend mode |
| 8. Lighting | Per-cell tint from light sources, darkness, luminescence | Multiply tint across all layers below | Core to Brogue's visual identity |
| 9. Status effect | On-fire, entranced, paralyzed, hasted (on entity) | Additive or screen blend on entity only | Per-creature overlay |
| 10. Bolt / projectile | Staff zap trail, thrown item arc | Alpha with glow | Transient, one frame per turn step |
| 11. UI overlay | Cursor highlight, movement path preview, explosion flash, targeting | Colored overlay or outline | Highest z-order |

**Key questions:**
- Should lighting (layer 8) be a single multiply pass over the composited result of layers
  1-7, or should each layer be tinted individually? Currently each sprite is tinted
  individually via the offscreen `tintCanvas` — this may be correct but needs validation
  for multi-layer cells.
- Gas/cloud transparency: what alpha value? Does it vary by gas density (`Pcell.volume`)?
- Bolt rendering currently uses `hiliteCell` which tints the whole cell — should bolts be
  sprites, colored overlays, or both?
- How do we handle cells with many simultaneous layers (e.g., foliage on grass, with a
  monster on top, in confusion gas, lit by a torch)? Performance implications of 4-5
  `drawImage` calls per cell?

---

## 5. Decisions Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| (smoke test) | Use Canvas2D `multiply` for sprite tinting | Preserves sprite detail and responds to Brogue's per-cell lighting | `source-atop` (flat, washed out); WebGL shader (overkill for turn-based) |
| (smoke test) | Viewport-only sprites; sidebar and messages stay as text | Simplest approach; avoids font spritesheet effort; sidebar is fundamentally text | Sprite-ify everything; hybrid bitmap font |
| (smoke test) | DawnLike 16x16 as development placeholder tileset | Free (CC-BY-SA), comprehensive roguelike coverage, matches Stardew Valley reference size | Oryx 16-bit (commercial); AI-generated (inconsistent); colored rectangles (too abstract) |
| (one-to-one) | Option B: thread TileType through display pipeline | Avoids DisplayGlyph enum inflation; scales to all terrain/features | Option A: add new DisplayGlyph per TileType (enum explosion) |
| (foreground) | `destination-in` after multiply to restore alpha | Multiply alone fills transparent pixels with tint color, destroying transparency | Separate alpha channel manipulation; pre-multiplied alpha sprites |
| (foreground) | Same fg/bg multiply tint for both foreground and background layers | Keeps lighting consistent across layers | Different tint per layer (would look wrong with Brogue's lighting model) |
| (research) | 8-bit blob autotiling (47 tiles) with connection groups | Inner corner quality; industry standard (RPG Maker, Godot, Celeste); Excalibur.js TypeScript reference | 4-bit cardinal/16 tiles (CDDA uses this, simpler but no inner corners); Wang tiles (too complex) |
| (research) | 2-directional creature facing (left/right flip) | CDDA does exactly this; DCSS has none; no roguelike does 4-dir | 4-directional (quadruples art); no facing (DCSS approach) |
| (research) | White/grayscale sprites for production art | Brogue's color system encodes gameplay; white × color = exact color | Colored sprites + multiply (current prototype, muddy results); Qud 3-color (worth prototyping) |
| (research) | Compute adjacency at draw time in renderer | CDDA validates this in production; avoids cache invalidation | Cached grid (upgrade path if needed); getCellAppearance (adds complexity to game logic) |
| (research) | Connection groups for cross-type neighbor matching | Walls→doors, water→deep water need cross-type connections (CDDA pattern) | Identity-only matching (too limited for Brogue) |

---

## 6. Roadmap

Ordering updated based on research findings (Section 3.S). Each initiative gets a
one-paragraph intent statement here; full BRIEF/PLAN/TASKS are created when the initiative
starts.

### Status Table

| # | Initiative | Status | Depends On | Notes |
|---|-----------|--------|------------|-------|
| 0a | pixel-art-smoke-test | **complete** | — | Proved end-to-end sprite rendering |
| 0b | pixel-art-one-to-one | **complete** (playtest pending) | 0a | TileType through pipeline |
| 0c | pixel-art-foreground-tiles | **complete** | 0b | Two-layer draw, transparency fix |
| R1 | Open source research | **complete** | — | 3 deep-dives + synthesis done |
| 1 | Renderer refactor | not started | 0a-0c | — |
| 2 | Layer compositing model | not started | 1 | 11-layer stack validated by R1 |
| 3 | Autotiling system | not started | 1, 2 | 8-bit blob + connect_groups (decided in R1) |
| 4 | Creature facing | not started | 1 | 2-directional left/right flip (decided in R1) |
| 5 | Effect overlays | not started | 2 | — |
| 6 | Viewport / camera system | not started | 1 | See Open Questions |
| 7 | Animation framework | not started | 2 | — |
| 8 | Art pipeline | not started | — | White sprites for production (decided in R1) |

> Update this table when an initiative completes or is created.

### Initiative 1: Renderer Refactor

Extract a `Renderer` interface from the monolithic `plotChar` in `browser-renderer.ts`.
Split into `TextRenderer` and `SpriteRenderer` implementations. Move sprite map data,
tileset loading, and tinting logic into the sprite renderer. Keep shared infrastructure
(cell sizing, event handling, input queue) in the console. Mode switching selects the
active renderer. This cleans up the prototype code from initiatives 0a-0c and creates the
extension point for all future rendering work.

### Initiative 2: Layer Compositing Model

Define the fixed layer stack (background, terrain feature, surface effect, item, entity,
gas, lighting, status, bolt, UI) and implement a compositing pipeline in `SpriteRenderer`.
Each cell is drawn as a sequence of layer draws with per-layer blend modes. Replaces the
ad-hoc foreground/background/underlyingTerrain logic with a general system.

### Initiative 3: Autotiling System

Implement 8-bit blob bitmask computation (47 tile variants) with CDDA-style connection
groups for cross-type neighbor matching. The bitmask algorithm and 256→47 lookup table
come from Excalibur.js (Section 3.5). Connection groups (`WALL`, `WATER`, `LAVA`, `FLOOR`)
enable walls connecting to doors, water connecting to deep water, etc. Computed at draw
time in the sprite renderer (validated by CDDA's approach). Requires 47 variant sprites
per connectable terrain type (~6-8 types = ~280-370 autotile sprites).

### Initiative 4: Creature Facing

Add `lastMoveDir` to `Creature`. Set it during movement. Sprite renderer applies horizontal
flip (`ctx.scale(-1, 1)`) for left-facing creatures. 2-directional only — validated by CDDA
(which does exactly this) and DCSS (which has no facing at all). Default facing: right.
Vertical movement retains previous horizontal facing.

### Initiative 5: Effect Overlays

Gas clouds, fire, status effects rendered as composited sprite layers using the layer
model from Initiative 2. Gas transparency keyed to `Pcell.volume`. Fire uses animated
overlay. Status effects (on-fire, entranced, paralyzed) drawn on top of entity sprite.

### Initiative 6: Viewport / Camera System

Render the dungeon at 2x or 3x tile scale, showing only a portion of the 79x29 grid
centered on the player. Camera follows player movement. Sidebar and message area rendered
as fixed framing outside the scrolling viewport. Addresses the pixel-art-looks-too-small
problem without requiring browser zoom.

### Initiative 7: Animation Framework

Sprite frame cycling for idle states (torch flicker, water shimmer). Movement interpolation
(creature slides between cells over a short duration). Attack/hit flash animations. Bolt
trail animations. All animations are turn-triggered and play to completion before the next
input is accepted.

### Initiative 8: Art Pipeline

Tooling for creating and processing production-quality sprites. Target **white/grayscale
sprites** for production art (tiles.c approach, Section 3.1A) — prototype alongside
Caves of Qud 3-color system (Section 3.7) and compare. Adopt CDDA's 4x4 autotile template
approach: author one template image per terrain type, slice into 47 named connection
sprites. Build a spritesheet packer (inspired by CDDA's `compose.py` but TypeScript-native).
Optional: build-time color variant generation (inspired by DCSS's `%hue`/`%lum`/`%desat`).
The `initiatives/pixel-art-pipeline/` initiative has a preliminary BRIEF/PLAN/TASKS.

---

## 7. Open Questions

### Resolved by research (Section 3)

- ~~**White-sprite vs. colored-sprite tinting.**~~ **Resolved:** White/grayscale sprites for
  production art. Caves of Qud 3-color system worth prototyping as alternative. See
  Section 3.S (Tinting strategy). Colored DawnLike sprites remain as development
  placeholders.
- ~~**Autotile algorithm choice.**~~ **Resolved:** 8-bit blob (47 tiles). CDDA uses 4-bit
  but we want inner corner quality. Excalibur.js (3.5) provides the TypeScript
  implementation. See Section 3.S (Autotiling).
- ~~**Creature facing: 2 or 4 directions?**~~ **Resolved:** 2-directional (left/right flip).
  CDDA does exactly this. DCSS has no facing at all. No open-source roguelike does
  4-directional. See Section 3.S (Creature facing).
- ~~**CDDA's connect_groups system.**~~ **Resolved:** Yes, adopt connection groups. Needed for
  wall→door, water→deep water connections. See Section 3.S (Autotiling).
- ~~**When to compute autotile adjacency.**~~ **Resolved:** At draw time in the renderer.
  CDDA validates this approach in production (5557-line cata_tiles.cpp). Cached grid is an
  upgrade path if needed. See Section 3.S (Autotiling).
- ~~**Tile processing categories.**~~ **Resolved:** Not needed now. All sprites are same-size
  grid-fit. Revisit only if we adopt tilesets larger than 16×16. See Section 3.1B.

### Still open

- **Color tinting quality on production sprites.** The research confirmed white sprites are
  the right approach, but we haven't actually tested multiply tinting on white/grayscale art
  yet. The DawnLike placeholders are colored. Need a prototype with actual white sprites to
  validate the visual quality before committing the art pipeline. Also need to compare
  against the Qud 3-color approach.
- **Viewport zoom and camera follow for pixel art mode.** Still open. Neither DCSS nor CDDA
  provided a directly applicable scrolling viewport model (both are C++/SDL with different
  grid assumptions). This remains a significant rendering change and is its own initiative
  (Initiative 6).
- **Performance with many layers per cell.** Still open. 11 layers × multiply tinting per
  sprite is the worst case. Canvas2D may need offscreen compositing or a WebGL upgrade. The
  research showed that neither DCSS nor CDDA does runtime per-pixel tinting, so we have no
  performance reference for this specific pattern.
- **How do we handle the title screen and other full-screen UI?** Still open. Keep as text
  for now.
- **Pixel art scaling strategy.** Still open. CSS `image-rendering: pixelated` on a
  fixed-size canvas is the current approach. The tiles.c progressive integer-division cell
  sizing (Section 3.1C) should be adopted for gap-free rendering regardless of scale.
- **CDDA's "bench vs. table" autotile philosophy.** Noted but deferred. Walls are
  "table-like" (center = solid). We'll address this during sprite authoring in Initiative 8,
  not in the autotile algorithm itself.

### New questions from research

- **Autotile template format for 47 tiles.** CDDA's 4x4 template gives 16 tiles. For
  47 tiles, we need a different template layout. RPG Maker uses a specific 6-tile mini
  template that generates 47 via quarter-tile assembly. Godot uses a full 47-tile atlas.
  Which template format should our art pipeline target? This affects Initiative 8.
- **Fallback chain depth.** CDDA has a `looks_like` chain for tile fallback. Our current
  two-tier lookup (TileType → DisplayGlyph) is simpler. Do we need a deeper chain, e.g.,
  `TileType → TileGroup → DisplayGlyph → text`? Affects Initiative 1.
- **Connection group granularity.** How many groups do we actually need? A preliminary count:
  `WALL`, `WATER`, `LAVA`, `FLOOR`, `CHASM`, `MUD/BOG`. Need to enumerate all connectable
  terrain types in Brogue and assign groups before starting Initiative 3.

---

## 8. Reference: Technical Context

### SWOT Analysis (from initial-exploration.md, updated)

**Strengths:**
- Clean `plotChar` rendering abstraction — game logic has zero rendering knowledge
- Finite sprite catalog (~120 DisplayGlyphs, ~200 TileTypes)
- Turn-based = no frame-rate pressure; Canvas2D is sufficient
- C `tiles.c` as working reference implementation
- `GraphicsMode` enum and G-key switching already work
- Prototype code proves the approach end-to-end

**Weaknesses:**
- 100-column grid is wide: 100 * 16px = 1600px at 1x; pixel art looks small without zoom
- Color tinting deeply embedded in gameplay — risk of muddy results on detailed sprites
- Sidebar and message area are fundamentally text — hybrid approach adds complexity
- No artist on the project — production sprites are a separate, unsolved problem
- Prototype code is architecturally rough — renderer refactor needed before extending

**Opportunities:**
- Modular renderer architecture supports multiple art styles (ASCII, pixel, high-res)
- Animation system could dramatically improve game feel
- Pixel art broadens audience beyond ASCII roguelike enthusiasts
- Well-defined spritesheet format enables community art packs

**Threats:**
- Color tinting quality on production sprites — untested beyond DawnLike placeholders
- Viewport scaling for arbitrary browser sizes (pixel art needs integer scaling)
- Multi-layer compositing complexity and performance
- Art asset pipeline — 200+ sprites in a consistent style is a major effort

### Tile Size vs. Screen Real Estate

| Tile size | Dungeon viewport (79x29) | Full grid (100x34) | Notes |
|-----------|-------------------------|---------------------|-------|
| 16x16 | 1264 x 464 | 1600 x 544 | Standard pixel art size. Looks small without zoom. |
| 24x24 | 1896 x 696 | 2400 x 816 | Good middle ground. |
| 32x32 | 2528 x 928 | 3200 x 1088 | Large, detailed. May need scrolling viewport. |

### Rendering Backend Comparison

| Option | Pros | Cons |
|--------|------|------|
| **Canvas2D** (current) | No dependencies, simple API, adequate for turn-based | Limited composite operations; per-cell drawImage may be slow for full redraws with many layers |
| **WebGL** (raw) | GPU-accelerated tinting via shaders, batch rendering | Significant complexity, boilerplate-heavy |
| **PixiJS** | WebGL-backed, high-level API, built-in sprite tinting and batching | External dependency (~200KB), may be more than needed |
| **Offscreen Canvas2D + WebGL composite** | Canvas2D for sprites, WebGL for tinting pass | Complex but separates concerns |

Current decision: Canvas2D. Revisit if multi-layer performance is insufficient (see Open
Questions).

### Color Tinting Approach

Brogue passes per-cell foreground and background RGB (0-100 scale). Current approach:
- **Background:** Fill cell with background RGB, draw sprite on top.
- **Foreground (sprite tinting):** Draw sprite to offscreen 16x16 canvas. Apply `multiply`
  composite with foreground color. Restore alpha via `destination-in` redraw. Blit to main
  canvas.

The C `tiles.c` uses white/grayscale sprites with `SDL_SetTextureColorMod` — foreground
color *becomes* the sprite color. Our prototype uses colored DawnLike sprites with multiply
— foreground color *modifies* the sprite color. The white-sprite approach is simpler but
sprites can't have inherent colors. Decision deferred to art pipeline.

### Sidebar Strategy

| Option | Description | Status |
|--------|-------------|--------|
| Keep as text | Sprite renderer handles dungeon viewport only | Current approach |
| Sprite-ify everything | Render text as sprites from a font spritesheet | Deferred |
| Hybrid bitmap font | Pixel-art-style bitmap font for text areas | Evaluate later |
