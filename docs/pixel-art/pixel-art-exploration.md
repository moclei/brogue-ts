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

> **Status:** Not yet performed. This section is a template for a dedicated research
> session. Work through each candidate, fill in findings, and update the status.

### Candidates

#### Tiles.c in BrogueCE (C source)
- **Link:** `src/platform/tiles.c` in this repo
- **Problem it solves:** Sprite rendering for the same game, using SDL2
- **Key takeaway:** (already partially documented in `initial-exploration.md` — white-sprite
  approach with `SDL_SetTextureColorMod`, 2048x5568 PNG, 384 tiles)
- **Status:** Partially reviewed

#### UnBrogue / Brogue forks with tile support
- **Link:** TBD (search GitHub for Brogue forks with tiles)
- **Problem it solves:** Same game, different tile approaches
- **Key takeaway:** _not yet reviewed_
- **Status:** Not started

#### DCSS tiles (Dungeon Crawl Stone Soup)
- **Link:** https://github.com/crawl/crawl
- **Problem it solves:** Mature tile system for a complex roguelike — autotiling, layered
  sprites, directional creatures, effect overlays, viewport scrolling
- **Key takeaway:** _not yet reviewed_
- **Specific questions:** How does DCSS handle viewport zoom/scroll? How does it do wall
  autotiling? What's its layer compositing model? How does it handle creature facing?
- **Status:** Not started

#### Cataclysm: DDA tileset system
- **Link:** https://github.com/CleverRaven/Cataclysm-DDA
- **Problem it solves:** JSON-driven tile definitions, rotation, adjacency-aware tiles
- **Key takeaway:** _not yet reviewed_
- **Specific questions:** How are tile variants defined in JSON? How does adjacency/rotation
  work? Is the format extensible for modding?
- **Status:** Not started

#### rot.js
- **Link:** https://github.com/nickyringland/nickyringland.github.io (ondras/rot.js)
- **Problem it solves:** TypeScript roguelike toolkit with tile rendering
- **Key takeaway:** _not yet reviewed_
- **Specific questions:** How does rot.js handle tile displays? What's the API for sprite
  rendering? Does it have any layering or autotile support?
- **Status:** Not started

#### Caves of Qud
- **Link:** Not open source, but well-documented community resources exist
- **Problem it solves:** Adjacency-aware tiles (wall autotiling), rich layered rendering
- **Key takeaway:** _not yet reviewed_
- **Status:** Not started

#### RPG Maker / Godot autotile
- **Link:** Godot docs (TileMap autotile), RPG Maker wiki
- **Problem it solves:** Well-documented autotiling algorithms (Wang tiles, blob patterns,
  bitmask-to-tile lookup tables)
- **Key takeaway:** _not yet reviewed_
- **Specific questions:** Which autotile algorithm best fits our case? 4-bit cardinal
  (16 variants) vs. 8-bit blob (47 variants) vs. Wang tiles?
- **Status:** Not started

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

**Decision needed:** Which autotile algorithm? Where to compute adjacency? (Pending research
in Section 3.)

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

**Decision needed:** 2-directional or 4-directional? (Affects art pipeline and sprite
count significantly.)

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

---

## 6. Roadmap

Preliminary ordering based on current understanding. The research session (Section 3) may
revise this significantly. Each initiative gets a one-paragraph intent statement here; full
BRIEF/PLAN/TASKS are created when the initiative starts.

### Status Table

| # | Initiative | Status | Depends On | Notes |
|---|-----------|--------|------------|-------|
| 0a | pixel-art-smoke-test | **complete** | — | Proved end-to-end sprite rendering |
| 0b | pixel-art-one-to-one | **complete** (playtest pending) | 0a | TileType through pipeline |
| 0c | pixel-art-foreground-tiles | **complete** | 0b | Two-layer draw, transparency fix |
| 1 | Renderer refactor | not started | 0a-0c | — |
| 2 | Layer compositing model | not started | 1 | — |
| 3 | Autotiling system | not started | 1, 2 | Pending research |
| 4 | Creature facing | not started | 1 | — |
| 5 | Effect overlays | not started | 2 | — |
| 6 | Viewport / camera system | not started | 1 | See Open Questions |
| 7 | Animation framework | not started | 2 | — |
| 8 | Art pipeline | not started | — | Can proceed in parallel |

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

Implement adjacency bitmask computation (4-bit or 8-bit, decided during research) and a
bitmask-to-sprite-variant lookup table. Walls, floors, and water get variant sprites based
on their neighbors. Compute adjacency either in the display pipeline or as a cached grid
updated on terrain changes. Requires variant sprites in the tileset.

### Initiative 4: Creature Facing

Add `lastMoveDir` to `Creature`. Set it during movement. Sprite renderer uses facing
direction to select left/right sprite variant (or 4-directional if art supports it).
Horizontal flip for 2-directional is the minimum viable approach.

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

Tooling for creating and processing production-quality sprites. Prompt generation for
AI-assisted art (Midjourney/etc.), post-processing scripts (background removal, downscale,
palette reduction), spritesheet packing, and integration with the sprite registry. The
`initiatives/pixel-art-pipeline/` initiative has a preliminary BRIEF/PLAN/TASKS for this.

---

## 7. Open Questions

### Carried forward from initial-exploration.md (still relevant)

- What does color tinting actually look like on production-quality (non-placeholder) sprites?
  The smoke test validated multiply tinting on DawnLike tiles, but DawnLike's simple pixel
  art may tint differently than more detailed sprites.
- Should sprites be white/grayscale (foreground color fully determines visual) or have
  inherent colors with tinting as a modifier? The C `tiles.c` uses white sprites. Our
  prototype uses colored DawnLike sprites with multiply. These produce different results.
- How do we handle the title screen and other full-screen UI (inventory, help) — keep as
  text, or sprite-ify?
- What's the right scaling strategy for pixel art in arbitrary browser window sizes?
  CSS `image-rendering: pixelated` on a fixed-size canvas, or render to an offscreen canvas
  and scale up?

### New questions from this planning

- **Viewport zoom and camera follow for pixel art mode.** Pixel art sprites at 16x16 appear
  visually smaller than the ASCII glyphs they replace, requiring browser zoom to see detail.
  But browser zoom pushes the sidebar, message area, and bottom panel out of view. A
  dedicated "pixel art viewport" mode could: render the dungeon at 2x or 3x tile scale,
  show only a portion of the 79x29 dungeon grid centered on the player, scroll/pan as the
  player moves, and keep the sidebar and message area as fixed framing outside the scrolling
  viewport. This is a significant rendering change (the current model draws all 100x34 cells
  at fixed positions) and should be its own initiative. Research: how does DCSS handle this?
  How does the C BrogueCE `tiles.c` handle tile scaling vs. viewport size?
- **Autotile algorithm choice.** 4-bit cardinal (16 variants, simple, no corners) vs. 8-bit
  blob (47 variants, handles corners, industry standard) vs. Wang tiles (mathematical,
  complex). The right choice depends on art complexity and tileset size. Research references
  in Section 3 should inform this.
- **Creature facing: 2 or 4 directions?** 2-directional (left/right + flip) is half the art
  but can look odd for vertical movement. 4-directional is standard but quadruples creature
  sprite count.
- **Performance with many layers per cell.** A cell with foliage on grass, a monster, in
  confusion gas, lit by a torch could need 5+ `drawImage` calls. Is Canvas2D fast enough
  for this on a full 79x29 viewport redraw? Should we batch via offscreen canvases or
  consider WebGL for the sprite renderer?
- **When to compute autotile adjacency.** Terrain changes during play (doors open, bridges
  collapse, lava spreads, dungeon features trigger). If adjacency is cached, how do we
  invalidate? If computed at render time, is it fast enough?

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
