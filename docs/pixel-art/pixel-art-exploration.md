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

All prototype code from these initiatives was replaced during Initiative 1 (Renderer
Refactor) and Initiative 2 (Layer Compositing Model). The ad-hoc `plotChar` tile branches,
`underlyingTerrain` plumbing, foreground-to-background map, and Hybrid mode were removed.

---

## 3. Research: Open Source References

> **Status:** All research complete. Three deep-dives (tiles.c, DCSS, CDDA) finished.
> Reference-tier and skip-tier candidates reviewed. Synthesis and recommendations in
> Section 3.S below.

> **Deep-dive findings archived.** The raw research for tiles.c (3.1), DCSS (3.2),
> CDDA (3.3), and all reference/skip/new candidates (3.4–3.14) have been moved to
> `docs/pixel-art/research-deep-dives.md` to keep this document within context-window
> budget. The synthesis below contains all actionable conclusions.

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

#### Layer compositing: 10 layers, implemented (lighting revised post-initiative)

**Decision:** The proposed 11-layer stack was refined to **10 layers** during implementation.
Both DCSS (3 stored layers + flags + overlays ≈ 7 effective layers) and CDDA (11 explicit
draw layers) validated that production roguelikes use this order of magnitude.

**Post-initiative revision (bug-testing):** The original implementation applied per-cell
lighting as a per-layer tint multiply (each sprite's tint was
`tileCatalog.foreColor × lightMultiplierColor × bakeTerrainColors`). This **mangled colored
pixel art sprites** — the multiply wash turned detailed sprites into muddy single-color
blobs. The fix was to move lighting to a **post-sprite overlay**: all sprite layers draw
with their base tileCatalog colors (no lighting multiply), then a single
`RenderLayer.VISIBILITY` entry carrying `lightMultiplierColor` is drawn as a multiply
composite fill over the entire cell. Fog-of-war overlays (remembered, clairvoyant, etc.)
stack on top of the lighting overlay. TERRAIN sprites additionally skip per-layer tinting
entirely (`blendMode: "none"`), and the cell background uses a fixed dark color
(`rgb(10,10,18)`) instead of game-computed `bgColor`.

This approach is closer to how DCSS and CDDA handle lighting (pre-baked or overlay-based)
than the original per-layer multiply design. The key difference is that our overlay is
still driven by Brogue's continuous per-cell RGB lighting values, not discrete lighting
states.

**Revised layer stack** (as implemented, with post-initiative corrections):

| Layer | Content | Compositing | Source |
|-------|---------|-------------|--------|
| 0. TERRAIN | Floor, wall, chasm, bridge | Opaque sprite, no tint (base colors) | All three references |
| 1. SURFACE | Liquid (alpha), foliage, fungus, cobweb, blood | Alpha overlay; shallow liquids at 0.55 alpha | CDDA `draw_field_or_item` |
| 2. ITEM | Weapon, potion, scroll on ground | Alpha over terrain | CDDA `draw_field_or_item` (items) |
| 3. ENTITY | Player, monster (hallucination-aware) | Alpha over terrain | CDDA `draw_critter_at` |
| 4. GAS | Poison gas, steam, confusion, healing cloud | Semi-transparent alpha (volume-based) | DCSS `bk_cloud` layer |
| 5. FIRE | Plain fire, brimstone, gas fire, explosion | Alpha overlay | No direct reference |
| 6. VISIBILITY | Lighting overlay + fog-of-war | Multiply composite fill | Unique to Brogue |
| 7. STATUS | On-fire, entranced, paralyzed overlays | — | Future (Initiative 5) |
| 8. BOLT | Bolt trail, thrown item arc | — | Future (Initiative 7) |
| 9. UI | Cursor, path preview, targeting | — | Future |

**Key architectural choices:**
- **Lighting as overlay, not per-layer tint.** Colored pixel art sprites retain their
  inherent colors; lighting is applied as a single multiply pass over the composited cell.
  White (100,100,100) = no darkening; darker values = ambient shadow; colored values =
  tinted light (e.g., torch glow). This preserves sprite detail while still expressing
  Brogue's per-cell lighting.
- **Liquids on SURFACE layer.** `DungeonLayer.Liquid` renders on `RenderLayer.SURFACE`
  (not TERRAIN) so shallow water types can be semi-transparent (alpha 0.55), showing the
  floor sprite beneath. Deep water and lava remain opaque. Surface decorations (foliage,
  blood) yield to liquids unless they have higher `drawPriority`. Long-term, liquids should
  be promoted to their own dedicated layer (see Initiative 9 in the roadmap).
- **VISIBILITY is a LayerEntry.** Unlike the original design where VISIBILITY was purely
  a renderer behavior, it is now a `LayerEntry` in the sparse array (carrying
  `lightMultiplierColor` in its `tint` field). The renderer draws it as a multiply
  composite fill, then stacks fog-of-war overlays on top.

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

> **Status: Complete** (Initiative 1: Renderer Refactor, Phases 1–5).
>
> Extracted `Renderer` interface with `TextRenderer` and `SpriteRenderer` implementations.
> `plotChar` dispatches to the active renderer based on `GraphicsMode`. Sprite map data in
> `glyph-sprite-map.ts`, tileset loading in `tileset-loader.ts`. Progressive
> integer-division cell sizing adopted from tiles.c. G-key toggles Text ↔ Tiles.

### 4d. Layer Model and Compositing

> **Status: Implemented** (Initiative 2: Layer Compositing Model, Phases 1–7), then
> revised during bug testing (post-initiative commits `25a85c3`, `5a3fc00`, `2c1a306`).
>
> The original 11-layer proposal was refined to a **10-layer `RenderLayer` enum**.
> VISIBILITY (layer 6) is a `LayerEntry` carrying `lightMultiplierColor`; the renderer
> draws it as a multiply composite fill for per-cell lighting, then stacks fog-of-war
> overlays on top. Liquids were split from TERRAIN to SURFACE with semi-transparent alpha
> for shallow water. See `initiatives/layer-compositing-model/PLAN.md` for the original
> design and Section 3.S for the post-initiative revision notes.

**Implemented layer stack (10 layers, post-revision):**

| # | Layer | Examples | Compositing | Status |
|---|-------|----------|-------------|--------|
| 0 | TERRAIN | Floor, wall, chasm, bridge | Opaque sprite, no tint | Implemented |
| 1 | SURFACE | Liquid (shallow at alpha 0.55), foliage, fungus, blood, debris | Alpha overlay | Implemented |
| 2 | ITEM | Item on ground (potion, weapon, scroll) | Alpha overlay | Implemented |
| 3 | ENTITY | Player, monster (hallucination-aware) | Alpha overlay | Implemented |
| 4 | GAS | Poison gas, steam, confusion, healing cloud | Alpha (volume-based) | Implemented |
| 5 | FIRE | Plain fire, brimstone, gas fire, explosion, embers | Alpha overlay | Implemented |
| 6 | VISIBILITY | Lighting overlay (lightMultiplierColor) + fog-of-war | Multiply composite fill | Implemented (LayerEntry) |
| 7 | STATUS | On-fire, entranced, paralyzed overlays | — | Future (Initiative 5) |
| 8 | BOLT | Bolt trail, thrown item arc | — | Future (Initiative 7) |
| 9 | UI | Cursor, path preview, targeting | — | Future |

**Resolved questions:**
- **Per-layer vs. single-pass lighting:** Per-layer tinting was implemented first but
  mangled colored pixel art sprites. Revised to a **post-sprite lighting overlay**: all
  sprite layers draw with base tileCatalog colors, then `RenderLayer.VISIBILITY` applies
  `lightMultiplierColor` as a single multiply composite fill. TERRAIN layer additionally
  skips all per-layer tinting. This preserves sprite detail while expressing Brogue's
  per-cell lighting.
- **Liquid rendering:** `DungeonLayer.Liquid` renders on `RenderLayer.SURFACE` (not
  TERRAIN). Shallow water types (`isShallowLiquid()`) render at alpha 0.55 so the floor
  sprite shows through; deep water and lava remain opaque. Long-term, liquids should be
  promoted to their own dedicated `RenderLayer.LIQUID` between TERRAIN and SURFACE (see
  Initiative 9 in the roadmap).
- **Gas transparency:** Volume-based alpha (`volume / 100`), implemented.
- **Multi-layer performance:** Skip-tinting fast path, ImageBitmap pre-creation, and
  OffscreenCanvas mitigate the cost. Typical cells have 1–2 layers.
- **Cell background:** Fixed dark color (`rgb(10,10,18)`) instead of game-computed
  `bgColor`, which was washing out sprites with lighting colors underneath.

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
| (layer-compositing bug testing) | Lighting as post-sprite multiply overlay, not per-layer tint | Per-layer multiply mangled colored pixel art sprites; overlay preserves sprite detail while expressing per-cell lighting | Per-layer tint (original implementation, abandoned); WebGL shader pass (overkill) |
| (layer-compositing bug testing) | TERRAIN layer skips tinting; fixed dark cell background | Game-computed bgColor washed out sprites; base sprite colors are correct without lighting multiply | Per-layer tint on terrain (produced muddy results) |
| (layer-compositing bug testing) | Liquids on SURFACE layer with shallow-water alpha 0.55 | Floor sprites visible through shallow water; deep water/lava stay opaque | Liquids on TERRAIN (original; no see-through); dedicated LIQUID layer (future improvement) |
| (layer-compositing bug testing) | Default graphics mode: Tiles (not Text) | Sprite mode is now the primary experience | Text as default (original) |

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
| 1 | Renderer refactor | **complete** | 0a-0c | Phases 1–5; TextRenderer, SpriteRenderer, progressive cell sizing |
| 2 | Layer compositing model | **complete** | 1 | 10-layer stack; post-initiative revision: lighting as overlay, liquids on SURFACE with alpha, fixed cell bg |
| 3 | Autotiling system | **complete** | 1, 2 | 8-bit blob + connect_groups; 7 groups, 47 variants, F2 debug panel |
| 4 | Creature facing | not started | 1 | 2-directional left/right flip (decided in R1) |
| 5 | Effect overlays | not started | 2 | Gas/fire already implemented; STATUS layer remains |
| 6 | Viewport / camera system | not started | 1 | See Open Questions |
| 7 | Animation framework | not started | 2 | — |
| 8 | Art pipeline | not started | — | White sprites for production (decided in R1) |
| 9 | Liquid layer promotion | not started | 2 | Dedicated LIQUID RenderLayer between TERRAIN and SURFACE |
| 10 | Developer tools expansion | not started | 3, 5, 7 | Scope TBD — informed by autotiling, effects, and animation work |

> Update this table when an initiative completes or is created.

### Initiative 1: Renderer Refactor

Extract a `Renderer` interface from the monolithic `plotChar` in `browser-renderer.ts`.
Split into `TextRenderer` and `SpriteRenderer` implementations. Move sprite map data,
tileset loading, and tinting logic into the sprite renderer. Keep shared infrastructure
(cell sizing, event handling, input queue) in the console. Mode switching selects the
active renderer. This cleans up the prototype code from initiatives 0a-0c and creates the
extension point for all future rendering work.

### Initiative 2: Layer Compositing Model (**complete**, revised post-initiative)

Implemented a 10-layer compositing pipeline: `getCellSpriteData()` produces per-layer sprite
data, and `drawCellLayers()` in `SpriteRenderer` draws each layer. Replaced the ad-hoc
foreground/background/underlyingTerrain logic. Full surface/gas/fire TileType coverage with
DawnLike placeholder sprites. Hybrid mode removed; clean Text ↔ Tiles toggle.

**Post-initiative revisions** (bug testing discovered that per-layer multiply tinting
mangled colored sprites):
- Lighting moved from per-layer tint to a post-sprite `RenderLayer.VISIBILITY` overlay
  (multiply composite fill with `lightMultiplierColor`)
- TERRAIN layer skips per-layer tinting entirely; cell background uses fixed dark color
- Liquids split from TERRAIN to SURFACE with `isShallowLiquid()` alpha (0.55)
- Sprite layer debug panel (F2) added for runtime inspection
- Default graphics mode changed to Tiles

See `initiatives/layer-compositing-model/` for the original design and implementation notes.

### Initiative 3: Autotiling System (**complete**)

Implemented 8-bit blob bitmask computation (47 tile variants) with CDDA-style connection
groups for cross-type neighbor matching. 7 connection groups (WALL, WATER, LAVA, CHASM,
FLOOR, ICE, MUD) covering 61 connectable TileTypes. `computeAdjacencyMask()` computes raw
8-bit bitmasks in `getCellSpriteData` for TERRAIN and SURFACE layers (live and remembered
cells). `BITMASK_TO_VARIANT` reduces 256 bitmasks to 47 canonical variants. Placeholder
sprites (same sprite for all 47 variants) make the system functional without new art. F2
debug panel shows bitmask, variant index, connection group, and 3×3 neighbor grid per
inspected cell. Spritesheet spec: 8×6 grid, 128×96px at 16×16, variant ordering per
`VARIANT_CANONICAL_MASKS` (see `docs/pixel-art/autotile-variant-reference.md`).
42 unit tests + 8 integration tests. See `initiatives/autotiling-system/`.

### Initiative 4: Creature Facing

Add `lastMoveDir` to `Creature`. Set it during movement. Sprite renderer applies horizontal
flip (`ctx.scale(-1, 1)`) for left-facing creatures. 2-directional only — validated by CDDA
(which does exactly this) and DCSS (which has no facing at all). Default facing: right.
Vertical movement retains previous horizontal facing.

### Initiative 5: Effect Overlays (partially complete)

Gas clouds and fire are already implemented as composited sprite layers (GAS and FIRE
`RenderLayer`s) from the layer compositing model. What remains is the **STATUS layer**
(RenderLayer 7): on-fire, entranced, paralyzed, and other status overlays drawn on top
of entity sprites. Flash effects (`creature.flashStrength`, `creature.flashColor`,
`hiliteCell`) also need a sprite-mode path — they are currently handled outside the layer
pipeline.

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

### Initiative 9: Liquid Layer Promotion

Promote liquids from their current position on `RenderLayer.SURFACE` (where they compete
with surface decorations like foliage, blood, and cobwebs) to a dedicated
`RenderLayer.LIQUID` between TERRAIN and SURFACE. This allows proper layering: floor
(TERRAIN) → water/lava (LIQUID) → foliage/debris (SURFACE). Shallow water alpha (0.55)
and deep water/lava opacity carry over. The `isShallowLiquid()` classification and
`DungeonLayer.Liquid` → `RenderLayer` routing in `getCellSpriteData` move to the new layer.
Requires renumbering the `RenderLayer` enum (inserting LIQUID at index 1, shifting SURFACE
to 2, etc.) and updating all consumers. Not urgent — the current SURFACE-sharing approach
works — but the correct long-term architecture for when autotiling and animation add
complexity to liquid rendering.

### Initiative 10: Developer Tools Expansion

Expand the sprite layer debug panel (F2) and add new developer tools as the rendering
system grows more complex. Scope is intentionally deferred — autotiling (Initiative 3),
effect overlays (Initiative 5), and animation (Initiative 7) will reveal what debugging
capabilities are most needed. Likely candidates include: autotile bitmask visualization
(overlay showing computed connection values per cell), animation frame stepping,
connection group inspection, per-cell layer breakdown tooltips, and performance profiling
integration. The current F2 panel provides the foundation (per-layer visibility toggles,
tint overrides, click-to-inspect) but will need to evolve as the pipeline grows.

---

## 7. Open Questions

### Resolved

All resolved via research (Section 3.S) or post-initiative implementation:

- **Art style:** White/grayscale sprites for production; DawnLike colored sprites for now.
- **Autotile algorithm:** 8-bit blob (47 tiles) with connection groups (CDDA-style).
- **Creature facing:** 2-directional (left/right flip via `scale(-1,1)`).
- **Adjacency computation:** At draw time in the renderer.
- **Tile processing categories:** Not needed (same-size grid-fit sprites).
- **Lighting model:** Post-sprite multiply overlay via `RenderLayer.VISIBILITY`.
- **Liquid placement:** SURFACE layer for now; Initiative 9 tracks dedicated LIQUID layer.

### Still open

- **Color tinting quality on production sprites.** The research confirmed white sprites are
  the right approach, but we haven't actually tested multiply tinting on white/grayscale art
  yet. The DawnLike placeholders are colored. The post-initiative lighting revision (overlay
  instead of per-layer tint) changes the dynamics here — white sprites would now be tinted
  only by the overlay pass, not by per-layer multiply. Need a prototype with actual white
  sprites to validate visual quality with the overlay model. Also need to compare against
  the Qud 3-color approach.
- **Viewport zoom and camera follow for pixel art mode.** Still open. Neither DCSS nor CDDA
  provided a directly applicable scrolling viewport model (both are C++/SDL with different
  grid assumptions). This remains a significant rendering change and is its own initiative
  (Initiative 6).
- **Performance with many layers per cell.** Partially addressed by the lighting revision.
  The per-layer multiply tint (which was the most expensive operation) is now replaced by
  a single multiply composite fill for lighting. Typical cells draw 1–2 sprites + 1
  lighting overlay + 0–1 fog-of-war overlays. Skip-tinting fast path, ImageBitmap
  pre-creation, and OffscreenCanvas are still in place. Full profiling deferred until
  autotiling adds more visual complexity per cell.
- **How do we handle the title screen and other full-screen UI?** Still open. Keep as text
  for now.
- **Pixel art scaling strategy.** Partially addressed. CSS `image-rendering: pixelated` on
  a fixed-size canvas is the current approach. Progressive integer-division cell sizing
  (from tiles.c, Section 3.1C) was adopted in Initiative 1 for gap-free rendering.
- **CDDA's "bench vs. table" autotile philosophy.** Noted but deferred. Walls are
  "table-like" (center = solid). We'll address this during sprite authoring in Initiative 8,
  not in the autotile algorithm itself.

### New questions from research

- **Autotile template format for 47 tiles.** *(Partially resolved.)* The autotiling system
  (Initiative 3) defines a spritesheet spec: 8×6 grid (128×96px at 16×16), 47 variants
  indexed by `VARIANT_CANONICAL_MASKS`. See `docs/pixel-art/autotile-variant-reference.md`
  for the complete variant-to-connectivity mapping. Art pipeline tooling (slicing templates
  à la CDDA's 4×4 or RPG Maker's mini-template assembly) is deferred to Initiative 8.
- **Fallback chain depth.** CDDA has a `looks_like` chain for tile fallback. Our current
  two-tier lookup (TileType → DisplayGlyph) is simpler. Do we need a deeper chain, e.g.,
  `TileType → TileGroup → DisplayGlyph → text`? Affects Initiative 1.
- **Connection group granularity.** *(Resolved.)* 7 groups implemented in Initiative 3:
  `WALL` (21 types incl. doors), `WATER` (9 types), `LAVA` (5 types), `CHASM` (10 types),
  `FLOOR` (10 types), `ICE` (4 types), `MUD` (2 types). Total: 61 connectable TileTypes.
  Each group declares `oobConnects` (true for WALL only). Full enumeration in
  `rogue-ts/src/platform/autotile.ts`.

---

## 8. Reference: Technical Context

### SWOT Analysis (from initial-exploration.md, updated)

**Strengths:**
- Clean `plotChar` rendering abstraction — game logic has zero rendering knowledge
- Finite sprite catalog (~120 DisplayGlyphs, ~200 TileTypes)
- Turn-based = no frame-rate pressure; Canvas2D is sufficient
- C `tiles.c` as working reference implementation
- `GraphicsMode` enum and G-key switching already work
- Full 10-layer compositing pipeline implemented and tested
- Lighting overlay model preserves sprite detail while expressing per-cell lighting
- F2 debug panel enables runtime inspection of all layers
- Multiple tilesets available (DawnLike, TheRoguelike, DemonicDungeon, Raven)

**Weaknesses:**
- 100-column grid is wide: 100 * 16px = 1600px at 1x; pixel art looks small without zoom
- Liquids sharing SURFACE layer with decorations (future: dedicated LIQUID layer)
- Sidebar and message area are fundamentally text — hybrid approach adds complexity
- No artist on the project — production sprites are a separate, unsolved problem

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

### Rendering Backend

Current: **Canvas2D** — no dependencies, simple API, adequate for turn-based rendering.
Revisit if multi-layer performance becomes insufficient (WebGL or PixiJS as alternatives).

### Color Tinting Approach

Brogue passes per-cell foreground and background RGB (0-100 scale). Current approach
(post-initiative revision):
- **Background:** Fixed dark fill (`rgb(10,10,18)`) — game-computed bgColor was washing
  out sprites.
- **Sprite layers:** Drawn with base tileCatalog colors. TERRAIN skips per-layer tinting
  entirely. Other layers may use per-layer tint for non-lighting color (e.g., gas backColor).
- **Lighting:** Applied as a single multiply composite fill via `RenderLayer.VISIBILITY`
  after all sprite layers. `lightMultiplierColor` values: white (100,100,100) = no change;
  darker = ambient shadow; colored = tinted light.
- **Fog-of-war:** Stacked on top of the lighting overlay via `getVisibilityOverlay()`
  (multiply fills for remembered, clairvoyant, etc.).

The C `tiles.c` uses white/grayscale sprites with `SDL_SetTextureColorMod` — foreground
color *becomes* the sprite color. Our current system uses colored DawnLike sprites with a
lighting overlay — the sprite retains its inherent colors and the overlay darkens/tints
the cell. The white-sprite approach is planned for production art (Initiative 8).

### Sidebar Strategy

| Option | Description | Status |
|--------|-------------|--------|
| Keep as text | Sprite renderer handles dungeon viewport only | Current approach |
| Sprite-ify everything | Render text as sprites from a font spritesheet | Deferred |
| Hybrid bitmap font | Pixel-art-style bitmap font for text areas | Evaluate later |

---

## 9. Developer Tools

### Sprite Layer Debug Panel (F2)

An in-game debug overlay for inspecting and tweaking the 10-layer sprite compositing
pipeline at runtime. Press **F2** to toggle the panel on/off. The panel floats in the
top-right corner and does not interfere with gameplay input.

**Per-layer controls** (one row per `RenderLayer`: TERRAIN, SURFACE, ITEM, ENTITY, GAS,
FIRE, VISIBILITY, STATUS, BOLT, UI):

| Control | What it does |
|---------|-------------|
| **Checkbox** | Toggle layer visibility on/off. Hidden layers are skipped entirely in `drawCellLayers`. |
| **Tint color picker** | Override the game's per-layer tint with a fixed color. Enable the checkbox next to the picker to activate. The override replaces the Brogue lighting/color tint for that layer only. |
| **Alpha slider** (0.0–1.0) | Override `globalAlpha` for the layer. Useful for making gas/fire semi-transparent to see terrain beneath. |
| **Blend mode dropdown** | Override the composite operation used for tinting (`multiply` is the default). Options: `source-over`, `screen`, `overlay`, `color-dodge`, `color-burn`. |

**Cell inspection — autotile info** (shown when an inspected cell has autotile data):

| Field | What it shows |
|-------|-------------|
| **group** | Connection group name (e.g., `WALL`, `WATER`). |
| **mask** | Raw 8-bit adjacency bitmask as binary + decimal (e.g., `01101011 (107)`). |
| **var** | Reduced variant index (0–46) from `BITMASK_TO_VARIANT`. |
| **3×3 grid** | Mini neighbor diagram — `█` = connected, `·` = not connected, `X` = self. |

**Global controls:**

| Control | What it does |
|---------|-------------|
| **Visibility Overlay** checkbox | Toggle the post-compositing visibility overlay (remembered/clairvoyant/telepathic dimming). Disabling reveals raw sprite colors without fog-of-war effects. |
| **Reset All** button | Restore all overrides to defaults. |

#### Architecture

- **Config:** `rogue-ts/src/platform/sprite-debug.ts` exports the `spriteDebug` singleton
  (`SpriteDebugConfig`). The object is read by `SpriteRenderer.drawCellLayers()` every
  frame — zero overhead when `enabled` is false.
- **Panel DOM:** `toggleDebugPanel(parentEl)` in the same file builds an HTML overlay
  with native inputs. All controls write directly to the `spriteDebug` singleton and set
  `dirty = true`.
- **Redraw trigger:** `bootstrap.ts` polls `spriteDebug.dirty` via `requestAnimationFrame`
  and calls `forceFullRedraw()` (from `platform.ts`) to schedule a full-screen repaint on
  the next `commitDraws()` cycle.
- **Hotkey:** An F2 `keydown` listener on `document` (capture phase) intercepts the key
  before it reaches the game's event queue.

#### Common debugging scenarios

| Scenario | Steps |
|----------|-------|
| **See raw sprites without lighting** | Disable Visibility Overlay; set all tint overrides to white (#ffffff). |
| **Isolate a single layer** | Uncheck all layers except the one you want to inspect. |
| **Check if a gas layer is rendering** | Set GAS alpha to 1.0 and tint to a bright color. |
| **Compare blend modes** | Select different blend modes on TERRAIN or SURFACE to see how they interact with tint colors. |
| **Verify surface-over-terrain stacking** | Disable all layers except TERRAIN and SURFACE. |
