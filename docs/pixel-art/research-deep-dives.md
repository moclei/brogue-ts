# Pixel Art Research — Deep-Dive Archive

> **What this document is:** Completed research findings archived from
> `docs/pixel-art/pixel-art-exploration.md` Section 3. All actionable conclusions from
> these findings have been synthesized into Section 3.S of the exploration doc.
>
> **When to read this:** Only if you need to trace a design decision back to its source
> evidence, or if you're revisiting a topic (e.g., CDDA's connect_groups) for deeper
> implementation detail. For normal initiative work, the exploration doc's Section 3.S
> (Synthesis and Recommendations) contains everything you need.
>
> **Status:** All research complete. No further investigation planned.

---

## Priority Tier: Deep-Dive Candidates

These are the candidates worth cloning/downloading and studying at the source level.

### 3.1. Tiles.c in BrogueCE (C source)

- **Link:** `src/platform/tiles.c` (813 lines), `src/platform/sdl2-platform.c` (mapping
  logic), `src/brogue/Rogue.h` (`enum displayGlyph`)
- **Problem it solves:** Sprite rendering for the same game, using SDL2
- **Relevance:** **Deep-dive** — this is our most direct reference. Same game, same
  `plotChar` abstraction, same display model.
- **Status:** Deep-dive complete

#### Deep-dive findings

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

**Recommendation:** Don't implement tile processing modes now. Revisit if we adopt tilesets
larger than 16×16 or if sprite size variation becomes a design goal.

**C. Multi-resolution texture strategy**

The C renderer solves the non-integer division problem: 100 columns into (say) 1600px
gives tiles of exactly 16px each, but 100 into 1593px gives 15.93px — some tiles must be
15px and others 16px.

The solution: pre-render all 384 tiles at 4 sizes — `W×H`, `(W+1)×H`, `W×(H+1)`,
`(W+1)×(H+1)` — into 4 GPU textures. During rendering, each cell picks the texture whose
tile dimensions match its computed width/height.

**Recommendation:** Don't replicate the 4-texture strategy. Do adopt the progressive
integer-division cell positioning: `cellX = x * canvasWidth / COLS`, `cellWidth =
((x+1) * canvasWidth / COLS) - cellX`. (Adopted in Initiative 1.)

**D. Procedural wall tops**

Three specific tile positions generate diagonal sine-wave patterns instead of using
sprite art. The pattern adapts to any tile size, used for decorative tops of stone walls.

**Recommendation:** Skip procedural wall tops. Use authored pixel art for wall transitions
and let the autotiling system handle variant selection.

**E. Tile-to-glyph mapping (charIndex)**

The mapping from game logic to tile grid is a three-step chain:
1. Game logic emits `enum displayGlyph` values
2. `fontIndex()` converts displayGlyph to charIndex (with tile/hybrid/text mode branching)
3. `tiles.c` converts charIndex to tile grid position (`row = charIndex / 16`, `col = charIndex % 16`)

Our `glyph-sprite-map.ts` uses a `Map<DisplayGlyph, SpriteRef>`, bypassing the charIndex
indirection entirely. Our approach is more flexible and doesn't constrain the spritesheet
layout.

**F. Confirmed limitations**

The C tile renderer has none of: autotiling, layer compositing, creature facing, animation,
or alpha blending between multiple sprites. These are the gaps solved by Initiatives 2–7.

---

### 3.2. DCSS tiles (Dungeon Crawl Stone Soup)

- **Link:** https://github.com/crawl/crawl (main), https://github.com/crawl/tiles (art assets)
- **Problem it solves:** Mature tile system for a complex roguelike
- **Status:** Deep-dive complete

#### Deep-dive findings

**A. tile_flavour: wall and floor variants**

DCSS uses weighted random variant selection (not adjacency-based autotiling). A
`tile_flavour` struct per cell stores a pre-picked variant from a pool of 4–16 sprites,
selected once at level generation via deterministic hash. Branch-specific tile mapping
via `tile_default_flv()`. Color variations generated at build time via `%hue`/`%lum`/`%desat`.

**B. Floor halo system**

The closest thing to autotiling in DCSS: 9-tile directional overlay system for floor cells
adjacent to specific features (grass, dirt). Also includes 8-direction overlays for slime,
ice, waves, and shore transitions. Wall shadow overlays (7 directional tiles) add depth.
Simpler than full bitmask autotiling but less flexible.

**C. Layer compositing model**

3-layer model (bk_bg, bk_fg, bk_cloud) + flag bits + overlays ≈ 7 effective layers.
Draw order: background → floor overlays → item/monster → cloud → status → icons → UI.
No multiply tinting — all color baked into tiles. Simpler than our 10-layer stack because
items and monsters are mutually exclusive per cell.

**D. Creature/monster tile selection — no facing**

DCSS does not implement creature facing. All sprites face a fixed direction by convention.
Only kraken tentacles have directional sprites (special case).

**E. Tile assignment: feature → tile mapping**

Two-step resolution: `tileidx_feature_base()` returns generic tile, `apply_variations()`
resolves to specific variant using `tile_flavour`. `tilepick.cc` (5179 lines) handles all
feature/monster/item → tile mapping.

**F. rltiles definition format**

Custom DSL for spritesheet packing + code generation. Key concept: `%hue`/`%lum`/`%desat`
generates 15 color variants of a wall type from a single set of source PNGs. Relevant to
our art pipeline (Initiative 8).

**G. Confirmed limitations**

No bitmask autotiling for walls/floors. No per-pixel tinting at render time. Simpler layer
model than expected. `tilepick.cc` is the real tile brain.

---

### 3.3. Cataclysm: DDA tileset system

- **Link:** https://github.com/CleverRaven/Cataclysm-DDA
- **Docs:** https://docs.cataclysmdda.org/TILESET.html,
  https://i-am-erk.github.io/CDDA-Tilesets/how-to/autotiles.html
- **Status:** Deep-dive complete

#### Deep-dive findings

**A. Multitile/autotile selection algorithm**

4-bit cardinal bitmask (N/S/E/W only, not 8-bit blob). 16 possible connection states
mapped to 6 subtile types: center, corner (4 rotations), t_connection (4), edge (2),
end_piece (4), unconnected (1). Algorithm in `get_rotation_and_subtile()` — single switch
on 4-bit value. Total: 16 unique visuals from 6 authored sprite sets.

**B. connect_groups — the connection model**

Group-based neighbor matching (not identity-based). `connect_groups` declares membership,
`connects_to` declares visual connections. Walls connect to doors, water connects to deep
water. Asymmetric and bitset-based. Fallback to same-type matching for tiles without groups.
Also: `rotates_to` system for tiles that orient toward neighbors (street lights → pavement).

**C. Multitile fallbacks**

Graceful degradation chain: subtile variant → base tile → `looks_like` chain → ASCII
fallback → unknown tile. Tilesets can define partial multitiles.

**D. Draw layer ordering — 11-layer model**

11 layer functions called in order per cell: terrain → furniture → graffiti → trap →
partial construction → field/item → vehicle (no roof) → vehicle (roof) → critter →
zone mark → zombie revival. Standard alpha compositing throughout.

**E. `layering.json`**

Context-sensitive sprite overrides for items/fields on specific furniture (not a general
layer-ordering system).

**F. Lighting/tinting — pre-baked texture variants**

5 copies of every tile at load time: normal, grayscale (shadow), night vision (green),
overexposed, memory (sepia/grayscale). Fundamentally incompatible with Brogue's continuous
per-cell RGB lighting.

**G. Creature facing — 2-directional**

`FacingDirection::LEFT`/`RIGHT` with `SDL_FLIP_HORIZONTAL`. Matches our proposed approach.

**H. Rotation and sprite selection**

Pre-rotated sprites (array indexing) or SDL runtime rotation. Multitile JSON format
defines center/corner/t_connection/edge/end_piece/unconnected subtiles. 16 sprites per
terrain type for the 4-bit system.

**I. Tile lookup and `looks_like` chain**

Fallback system: `t_brick_wall` → `t_wall` → `t_wall_half` → `unknown`. Tilesets can
define sprites at any specificity level.

**J. Confirmed findings**

4-bit cardinal (not 8-bit blob). No runtime tinting. 11 draw layers. Creature facing
exists. `layering.json` is narrower than expected. `compose.py` + `slice_multitile.py`
form a production art pipeline.

---

## Reference Tier: Useful Documentation, No Source Dive Needed

### 3.4. Godot TileMap / Terrains

- **Link:** https://docs.godotengine.org/en/4.5/tutorials/2d/using_tilesets.html
- Clearest documentation of autotiling algorithms. Two modes: "Match Corners and Sides"
  (8-neighbor, 47 tiles — blob/Wang) and "Match Sides" (4-neighbor, 16 tiles — cardinal).
  47-tile blob is the clear quality winner.

### 3.5. Excalibur.js Autotiling Blog Post + Demo

- **Link:** https://excaliburjs.com/blog/Autotiling%20Technique/
- **Demo:** https://github.com/jyoung4242/CA-itchdemo
- Complete TypeScript implementation of 8-bit bitmask autotiling with Wang blob tiles.
  Includes bitmask encoding, neighbor lookup, 256→47 lookup table, and rendering.
  Directly reusable for our `SpriteRenderer`.

### 3.6. `autotile` npm package

- **Link:** https://github.com/tlhunter/node-autotile
- Too limited and unmaintained. Same algorithm as Excalibur.js. We'd implement our own.

### 3.7. Caves of Qud tile system

- **Link:** https://wiki.cavesofqud.com/wiki/Modding:Tiles (closed source)
- 3-color tile system: black → foreground, white → detail, transparent → background.
  Middle ground between colored sprites and white sprites. Worth prototyping in art
  pipeline initiative.

---

## Skip Tier

### 3.8. rot.js
- Too simple. Thin grid-to-sprite mapper. No autotiling, adjacency, or compositing.

### 3.9. UnBrogue / Brogue forks
- No novel tile rendering approaches beyond tiles.c.

---

## New Candidates (discovered during research)

### 3.10. BrogueCE Issue #332 — Adjacency Tiles Proposal

- **Link:** https://github.com/tmewett/BrogueCE/issues/332
- Proposes 4 or 8 neighbor adjacency for tile selection. Includes visual examples of 8-bit
  blob templates. Directly validates our approach.

### 3.11. Excalibur.js CA Autotile Demo
- Optional supplement to 3.5.

### 3.12. `phaser3-autotile`
- Skip — tied to Phaser, same algorithm as Excalibur.js.

### 3.13. LDtk Level Designer
- **Link:** https://ldtk.io/docs/general/auto-layers/auto-layer-rules
- Visual autotile rule editor. Rules Assistant auto-generates rules from templates.
  Relevant to art pipeline (Initiative 8).

### 3.14. Flare Engine
- Skip — full C++ SDL2 engine, too different from our Canvas2D context.
