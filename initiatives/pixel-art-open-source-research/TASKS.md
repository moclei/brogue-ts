# Pixel Art Open Source Research — Tasks

## Phase 1: BrogueCE tiles.c Deep-Dive

- [x] Re-read `src/platform/tiles.c` with focus on: (a) the white-sprite tinting model —
  how `SDL_SetTextureColorMod` applies foreground color, what happens with the background
  color pass, and how this compares to our Canvas2D multiply approach; (b) the tile
  processing categories (`TileProcessing` table) — do we need equivalent stretch/fit/text
  modes?; (c) the multi-resolution texture strategy — how it handles non-integer window
  divisions and whether we need something similar for CSS pixel scaling; (d) the procedural
  wall tops (sine wave generation for rows 16/21/22) — is this something we'd want?
- [x] Update Section 3.1 in `pixel-art-exploration.md`: replace "Preliminary findings" with
  "Deep-dive findings" covering the above. Add concrete recommendations: should we adopt
  white sprites? Do we need tile processing modes?
- [x] Check `src/platform/tiles.h` and any other files that define the tile-to-glyph mapping
  in the C codebase — how does charIndex map to tile position? Document the mapping strategy.

# --- handoff point ---

## Phase 2: DCSS Tile System Deep-Dive

- [x] Clone DCSS repo with sparse checkout (see PLAN.md clone strategy). Verify the
  checkout contains `tileview.cc`, `rltiles/`, and `tiles_creation.txt`.
- [x] Read `crawl-ref/source/tileview.cc` — focus on: (a) how `tile_flavour` works for wall
  variants (is it bitmask-based? how many variants?); (b) the layer compositing model
  (which layers exist, draw order, blend modes); (c) creature/monster tile selection (any
  facing/direction logic?); (d) how dungeon tiles are assigned to cells.
  If the file is too long to read fully, focus on functions related to wall/floor tile
  selection and skip UI/menu tile logic.
- [x] Read `crawl-ref/source/rltiles/dc-dngn.txt` — understand how dungeon tiles are
  defined, named, and organized. How are wall variants specified?
  NOTE: dc-dngn.txt is just a 4-line header; actual tiles are in dc-wall.txt (2226 lines),
  dc-floor.txt (1435 lines), dc-feat.txt (1095 lines). Read dc-wall.txt and dc-floor.txt
  in full.
- [x] Skim `crawl-ref/docs/develop/tiles_creation.txt` — extract tile design principles,
  layer model documentation, and any autotile/variant documentation.
- [x] If context allows: check if `tilepick.cc` or `tilepick-p.cc` exists and handles
  tile-to-cell assignment separately from `tileview.cc`.
  ANSWER: Yes, both exist. tilepick.cc (5179 lines) is the main tile selection brain
  (feature→tile, monster→tile, item→tile, apply_variations). tilepick-p.cc (1235 lines)
  handles player doll equipment tile selection.
- [x] Update Section 3.2 in `pixel-art-exploration.md` with deep-dive findings.
- [x] Delete DCSS clone: `rm -rf _research/crawl`

# --- handoff point ---

## Phase 3: Cataclysm: DDA Tile System Deep-Dive

- [ ] Clone CDDA repo with sparse checkout (see PLAN.md clone strategy). Verify checkout.
- [ ] Check the size of `src/cata_tiles.cpp`. If > 2500 lines, split the reading: focus
  this session on the multitile/autotile selection logic (search for `multitile`,
  `connect`, `rotates_to`, `edge`, `corner`, `t_connection`). Skip general rendering
  infrastructure for a follow-up if needed.
- [ ] Read the autotile/multitile selection logic in `cata_tiles.cpp` — focus on: (a) how
  neighbor tiles are checked; (b) how the connection type (edge, corner, t_connection,
  center, end_piece, unconnected) is determined; (c) how `connect_groups` and `connects_to`
  differ from raw bitmask matching; (d) how fallbacks work when a specific variant is
  missing.
- [ ] Skim `src/sdltiles.cpp` for the layer compositing model — how many draw passes, what
  order, any special blend modes?
- [ ] Find and read a sample `tile_config.json` from an actual tileset (e.g., in
  `gfx/UltimateCataclysm/` or similar) — see the autotile format in practice with real
  data.
- [ ] If context allows: find `layering.json` and document its structure.
- [ ] Update Section 3.3 in `pixel-art-exploration.md` with deep-dive findings.
- [ ] Delete CDDA clone: `rm -rf _research/cdda`

# --- handoff point ---

## Phase 4: Synthesis and Recommendations

- [ ] Re-read Sections 3 and 4 of `pixel-art-exploration.md` (all findings + all technical
  challenges).
- [ ] Write Section `### 3.S. Synthesis and Recommendations` covering:
  - **Autotiling:** Recommended algorithm (4-bit vs 8-bit), data structures, where to
    compute (getCellAppearance vs renderer vs cached grid), connection groups or not.
    Cite which reference projects informed each decision.
  - **Layer compositing:** Recommended layer model (validate/revise the 11-layer table in
    Section 4d based on how DCSS and CDDA actually do it). Are 11 layers overkill? What
    do production roguelikes actually use?
  - **Creature facing:** What do DCSS/CDDA do? Is 2-directional (flip) standard? Does any
    roguelike actually do 4-directional?
  - **Tinting strategy:** White sprites vs. colored sprites vs. 3-color (Qud-style).
    Recommendation for our art pipeline.
  - **Architecture patterns:** Renderer interface patterns seen across projects. What
    should our `SpriteRenderer` look like based on real-world examples?
  - **Libraries/tools we could use or adapt:** Any code, algorithms, or tools from the
    research that we could directly use (e.g., bitmask lookup table from Excalibur.js,
    template format from CDDA, rltiles-style spritesheet packer).
- [ ] Update Section 6 (Roadmap) if the research changes initiative ordering or scope.
- [ ] Update Section 7 (Open Questions) — resolve questions that the research answered,
  add any new questions that emerged.
- [ ] Final review of all Section 3 entries for completeness and consistency.

## Deferred

_(nothing yet)_
