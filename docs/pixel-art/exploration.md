# Pixel Art Graphics — Exploration

> **What this document is:** A high-level research and planning reference for replacing
> BrogueCE's ASCII rendering with pixel art sprites, inspired by Stardew Valley's visual
> style. This is not an initiative — it sits above initiatives and proposes a sequence of
> them. Return here between initiatives to check the big picture.
>
> **What this document is not:** A task list, a technical spec, or a design doc for any
> single initiative. Those belong in each initiative's own BRIEF/PLAN/TASKS.

---

## Initiative Status

| # | Initiative | Status | Key Findings |
|---|-----------|--------|--------------|
| 1 | Smoke test | **active** | Initiative: `initiatives/pixel-art-smoke-test/`. Using DawnLike 16x16 tileset. |
| 2 | Spritesheet renderer | not started | — |
| 3 | Renderer abstraction | not started | — |
| 4 | Animation system | not started | — |
| 5 | Multi-tile sprites | not started | — |

> Update this table when an initiative completes or is abandoned — one row, one line.
> This is the only ongoing maintenance required on this document.

---

## 1. Context and Motivation

BrogueCE is a turn-based dungeon crawler currently rendered as Unicode glyphs on a
100x34 character grid (79x29 dungeon viewport + 20-column sidebar + 3-row message area).
Each cell carries a `DisplayGlyph` enum value plus foreground and background RGB colors
(0–100 scale). The color system is central to gameplay: lighting, status effects, terrain
variation, and fog of war all express through per-cell color tinting.

We want to explore whether pixel art sprites — taking Stardew Valley as an aesthetic
reference — could replace the ASCII glyphs while preserving (or enhancing) the game's
visual character. The goal is not to redesign the game, but to investigate what a
graphical layer change would involve, what it would look like, and what the hard problems
are.

### Why Stardew Valley as a reference?

Stardew Valley demonstrates that 16x16 pixel art at a consistent pixel density can be
visually rich and expressive. Its grid-based world, tile-based terrain, and entity sprites
that sometimes exceed their grid footprint are all patterns relevant to a roguelike.
However, SV is real-time with continuous animation, whereas Brogue is turn-based — so the
animation model would differ significantly.

### Current rendering pipeline

```
Game Logic → DisplayBuffer (100x34 cells, each: DisplayGlyph + fg RGB + bg RGB)
           → commitDraws() diffs against previous frame
           → plotChar() draws changed cells to Canvas2D
```

The sole rendering entry point is `plotChar()` in `browser-renderer.ts`. It receives a
`DisplayGlyph`, grid coordinates, and six color values. It currently draws a Unicode
glyph via `ctx2d.fillText()`. A sprite renderer would replace the body of this function
(or provide an alternative implementation) while the game logic remains untouched.

### Precedent in the C codebase

The C version already has a tile/sprite renderer in `src/platform/tiles.c`. It uses a
2048x5568 PNG spritesheet containing 384 tiles (128x232 pixels each, arranged 16 columns
x 24 rows). SDL2's `SDL_SetTextureColorMod` applies per-cell color tinting. This is
proof that the `plotChar` abstraction supports sprite rendering without game logic
changes.

---

## 2. Placeholder Art Strategy

For all development work, use quick-and-easy **16x16 placeholder sprites**. Options:

- **Colored rectangles / geometric shapes** — the absolute minimum. A colored square per
  glyph category (green for terrain, red for creatures, blue for items) with a simple
  distinguishing shape (circle for creatures, triangle for items, etc.). Zero art skill
  required; sufficient for validating the rendering pipeline.
- **Free open-source roguelike tilesets** — DawnLike (16x16, CC-BY-SA, ~400 tiles),
  Oryx 16-bit (16x16, commercial but cheap), or similar. These provide recognizable
  dungeon sprites that make playtesting more meaningful.
- **AI-generated placeholder sprites** — tools like Aseprite + generation could produce
  quick 16x16 tiles in a consistent style, though consistency across 120+ sprites is
  a challenge.

The goal is to **unblock engineering decisions without waiting on real art**. Final art
assets are a separate concern entirely, replaceable later by swapping the spritesheet and
updating the glyph-to-sprite mapping.

---

## 3. SWOT Analysis

### Strengths

- **Clean rendering abstraction.** The `BrogueConsole.plotChar()` interface already
  isolates all rendering behind a single function. The game logic has zero knowledge of
  how cells are drawn. This is the ideal insertion point for a sprite renderer.
- **Finite sprite catalog.** The `DisplayGlyph` enum defines ~120 distinct glyphs, already
  categorized into terrain, creatures, and items in `glyph-map.ts`. This is the complete
  list of sprites needed.
- **Turn-based = no frame-rate pressure.** Unlike a real-time game, we don't need 60fps
  sprite rendering. The display updates only when game state changes. Canvas2D is likely
  sufficient; we don't need WebGL just for performance.
- **C tile renderer as reference.** `tiles.c` is a working implementation of exactly what
  we want to build. It demonstrates spritesheet layout, glyph-to-tile mapping, color
  tinting, and tile sizing — all in the same game.
- **Existing `GraphicsMode` enum.** The codebase already has infrastructure for switching
  between graphics modes, which could be extended for ASCII vs. pixel art.

### Weaknesses

- **100-column grid is very wide.** At 16px per tile, the dungeon viewport alone is
  79 * 16 = 1264px wide, which is fine. But the full 100-column grid (including sidebar)
  at 16px = 1600px. On smaller screens, tiles become sub-16px after scaling, which
  destroys pixel art crispness. Scaling strategy needs thought.
- **Color tinting is deeply embedded in gameplay.** Brogue's lighting, status effects,
  poison overlays, and terrain variation all work by manipulating per-cell RGB values.
  Tinting pre-colored sprites with these RGB values may produce muddy or unnatural
  results compared to tinting a simple white glyph. This is probably the single biggest
  visual quality risk.
- **Sidebar and message area are text-heavy.** The 20-column sidebar shows monster info,
  item names, and status text. The 3-row message area shows game messages. These are
  fundamentally text, not sprites. A hybrid approach (sprites for dungeon, text for
  sidebar/messages) adds complexity.
- **No artist on the project.** Creating 120+ coherent, attractive 16x16 sprites in a
  consistent style is a significant art effort. Placeholder tilesets get us through
  development, but the final visual quality depends on art assets that don't exist yet.

### Opportunities

- **Modular renderer architecture.** If done well, the renderer swap could support multiple
  art styles — ASCII, pixel art, high-res tiles — selectable at runtime. This is valuable
  both for player preference and for future experimentation.
- **Animation system.** Even simple turn-triggered animations (attack flash, movement
  interpolation, idle breathing) could dramatically improve the game's feel. The turn-based
  model makes animation simpler than real-time: trigger on state change, play to
  completion, resume.
- **Broader audience appeal.** Pixel art is more visually accessible than ASCII for players
  unfamiliar with roguelike conventions. It could open the game to a wider audience.
- **Community contribution.** A well-defined spritesheet format and glyph mapping could
  enable community-contributed art packs / themes.

### Threats and Blockers

- **Color tinting quality.** If per-cell RGB tinting looks bad on sprites, the entire
  approach may need rethinking. Brogue's lighting is not optional — it's core to gameplay
  (dark areas, light sources, luminescent creatures). This needs to be tested early.
- **Viewport scaling.** Pixel art looks best at integer scale factors (1x, 2x, 3x).
  Browser windows come in arbitrary sizes. Non-integer scaling blurs pixel art. The C
  version handles this with multi-resolution textures; the browser version needs a
  strategy (CSS `image-rendering: pixelated`, offscreen canvas at native resolution, etc.).
- **Multi-tile sprites change the rendering model.** The current `plotChar` contract is
  strictly per-cell: draw one glyph in one cell. Sprites that span multiple cells (e.g.
  a 16x32 character occupying 1 tile but rendering across 2) require a layered rendering
  approach with z-ordering, which is fundamentally different. This is a Phase 5 concern
  but should be kept in mind from the start.
- **Art asset pipeline.** Even with placeholders for development, eventually someone needs
  to create production-quality sprites. The pipeline (tool → format → spritesheet packer
  → glyph mapping) should be designed to make this easy.

---

## 4. Key Technical Questions

### Tile size vs. screen real estate

| Tile size | Dungeon viewport (79x29) | Full grid (100x34) | Notes |
|-----------|-------------------------|---------------------|-------|
| 16x16 | 1264 x 464 | 1600 x 544 | Small but standard for pixel art. SV uses this. |
| 24x24 | 1896 x 696 | 2400 x 816 | Good middle ground. |
| 32x32 | 2528 x 928 | 3200 x 1088 | Large, high detail, may need scrolling on small screens. |

Starting at 16x16 keeps things simple and matches the SV reference. The renderer should
be tile-size-agnostic so we can experiment.

### Rendering backend

| Option | Pros | Cons |
|--------|------|------|
| **Canvas2D** | No dependencies, simple API, adequate perf for turn-based | Color tinting via `globalCompositeOperation` is limited; `drawImage` per cell may be slow for full redraws |
| **WebGL** (raw) | GPU-accelerated tinting via shaders, batch rendering | Significant complexity, boilerplate-heavy, overkill for turn-based? |
| **PixiJS** | WebGL-backed but high-level API, built-in sprite tinting, spritesheets, batching | External dependency (~200KB), may be more than we need |
| **Offscreen Canvas2D + WebGL composite** | Canvas2D for sprites, WebGL for tinting pass | Complex but separates concerns |

Recommendation: start with Canvas2D for the smoke test. If color tinting quality or
performance is insufficient, evaluate PixiJS as the next step. Raw WebGL is likely
overkill.

### Color tinting approach

Brogue passes per-cell foreground and background RGB values (0–100 scale). For ASCII,
the foreground color tints the glyph and the background fills the cell. For sprites:

- **Background:** Fill the cell with the background RGB, then draw the sprite on top.
  Straightforward.
- **Foreground (tinting the sprite):** This is the hard part. Options:
  - Canvas2D `globalCompositeOperation: 'multiply'` — multiply sprite colors by the
    foreground color. Works for darkening (lighting) but not for hue shifts.
  - Canvas2D draw-to-offscreen-canvas trick — draw sprite, then overlay a colored rect
    with `'source-atop'` composite mode. More flexible but per-cell overhead.
  - WebGL/PixiJS shader — multiply or replace sprite color channels. Best quality and
    performance, but requires WebGL.
  - **Use white/grayscale sprites** — like the C version's tile PNG. The foreground color
    *becomes* the sprite color via multiplication. This is the simplest approach and
    matches how Brogue already works (white glyph * foreground color). The tradeoff is
    that sprites can't have their own inherent colors.

The C `tiles.c` uses the white-sprite approach: tiles in the PNG are white outlines,
and `SDL_SetTextureColorMod` tints them. This is probably the right starting point.

### Sidebar strategy

The sidebar (columns 80–99) and message area (rows 0–2) contain dense text: monster
stats, item names, health bars, game messages. Options:

1. **Keep as text rendering.** The sprite renderer only handles the 79x29 dungeon viewport.
   Sidebar and messages continue to use `fillText()`. Simplest approach, least visual
   disruption.
2. **Sprite-ify everything.** Render text characters as sprites from a font spritesheet.
   Consistent look but significant effort for marginal benefit.
3. **Hybrid with styled text.** Use a pixel-art-style bitmap font for text areas to match
   the aesthetic, but don't use the tile spritesheet. Middle ground.

Recommendation: option 1 for early initiatives, evaluate option 3 later.

### Stardew Valley multi-tile sprites

SV characters are 16x32 — they occupy one 16x16 ground tile but the sprite extends one
tile upward. This means:

- Rendering must happen in layers: terrain first, then entities sorted by Y position
  (back to front) so overlapping sprites occlude correctly.
- The renderer needs to know entity positions, not just per-cell glyph values. The
  current `plotChar` interface doesn't provide this — it only knows about cells.
- This is a fundamental change to the rendering contract and should be deferred to a
  later initiative. The early initiatives should work within the per-cell model.

---

## 5. Possible Initiative Roadmap

High-level sequence only. Each initiative would get its own BRIEF/PLAN/TASKS when the
time comes. Dependencies flow downward — each builds on the previous.

### Initiative 1: Smoke Test

**Intent:** Prove the rendering swap works end-to-end with zero art assets.

**Existing infrastructure:** The TS port already has significant plumbing in place for
this. The `GraphicsMode` enum (TEXT_GRAPHICS, TILES_GRAPHICS, HYBRID_GRAPHICS) is ported,
`setGraphicsMode` is on the `BrogueConsole` interface, and the game logic that handles the
'G' key to cycle modes is likely wired up from the IO.c port. `isEnvironmentGlyph()` is
ported in `glyph-map.ts` (needed for hybrid mode). What's missing is the rendering itself:
`plotChar()` in `browser-renderer.ts` always draws Unicode text via `fillText()` regardless
of the current graphics mode. Pressing 'G' today probably cycles the mode variable and
shows the status message, but the screen looks identical.

The C version's `tiles.c` (marked "Not ported" in the manifest) is the reference for how
this was done with SDL2 -- a 384-tile PNG spritesheet with `SDL_SetTextureColorMod` for
per-cell color tinting.

**Approach:** Add a rendering branch inside `plotChar` (or provide a swappable renderer)
that checks `graphicsMode` and draws colored rectangles/shapes instead of text when tile
mode is active. Each `DisplayGlyph` maps to a distinct color/shape per category (green
for terrain, red for creatures, blue for items). The existing 'G' key toggle should
activate it without additional wiring. Play the game and observe: does it work? Does color
tinting look reasonable on colored blocks? How does the grid feel at 16px cells?

**What it proves:** The `plotChar` abstraction is sufficient. The display buffer diff model
works with non-text rendering. Color tinting is (or isn't) viable on solid shapes. The
existing `GraphicsMode` infrastructure works for switching renderers.

### Initiative 2: Spritesheet Renderer

**Intent:** Replace blocks with actual pixel art sprites, one sprite per cell.

Build a `DisplayGlyph` → spritesheet-region mapping. Load a 16x16 tileset (open-source
placeholder). Implement Canvas2D spritesheet rendering with color tinting. Handle the
dungeon viewport as sprites and the sidebar/messages as text. Evaluate tinting quality and
decide whether Canvas2D is sufficient or WebGL/PixiJS is needed.

**What it proves:** Sprites render correctly with Brogue's color system. The visual quality
is (or isn't) acceptable. Performance is (or isn't) adequate.

### Initiative 3: Renderer Abstraction

**Intent:** Make the graphics mode cleanly swappable at runtime.

Define a `Renderer` interface that both the text renderer and sprite renderer implement.
Move renderer selection into a factory/registry. Allow switching between ASCII and pixel
art modes via UI (the `GraphicsMode` enum already exists). Ensure both renderers work
correctly with all game states.

**What it proves:** The rendering layer is properly decoupled. Multiple renderers can
coexist. The architecture supports future renderers (high-res, themed, etc.).

### Initiative 4: Animation System

**Intent:** Add visual transitions between turns.

Sprite frame cycling for idle states (torch flicker, water shimmer). Movement interpolation
(creature slides between cells). Attack/hit flash animations. Map Brogue's existing flare
and flash systems to sprite animations. All animations are turn-triggered and play to
completion before the next input is accepted.

**What it proves:** Turn-based animation is viable and enhances the game feel without
disrupting gameplay pacing.

### Initiative 5: Multi-Tile Sprites

**Intent:** Allow entity sprites larger than one cell.

Implement layered rendering: terrain pass, then entity pass sorted by Y position. Expose
entity position data to the renderer (currently hidden behind per-cell `plotChar`). Support
16x32 character sprites (1 tile wide, 2 tiles tall). Evaluate larger multi-tile entities
(bosses, multi-square creatures).

**What it proves:** The rendering model can handle overlapping sprites. Layered rendering
works with Brogue's display model.

---

## 6. Open Questions

- What does color tinting actually look like on 16x16 sprites? This is the single highest
  risk item and should be tested in Initiative 1.
- Should the sprite tiles be white/grayscale (like the C version) so that foreground color
  fully determines the visual, or should they have inherent colors with tinting applied as
  a modifier?
- How do we handle the title screen and other full-screen UI (inventory, help) — keep as
  text, or also sprite-ify?
- Is there a free 16x16 roguelike tileset that covers enough of Brogue's glyph set to be
  useful as a development placeholder?
- What's the right scaling strategy for pixel art in arbitrary browser window sizes?
  CSS `image-rendering: pixelated` on a fixed-size canvas, or render to an offscreen
  canvas and scale up?
- Does the existing `GraphicsMode` enum and infrastructure support a clean ASCII/sprite
  toggle, or does it need rework?

---

## Relationship to Child Initiatives

This exploration doc is the **master reference** for the overall pixel art effort. Child
initiatives are self-contained for execution (BRIEF/PLAN/TASKS as usual) but each
initiative's BRIEF.md includes a pointer:

```
Parent exploration: docs/pixel-art/exploration.md
```

**Sync rule:** This document tracks *what we've learned and what's next*. Initiative docs
track *how to do the current thing*. No duplication of task lists or technical details
between them. When an initiative completes, update the status table row above and
optionally add a sentence to the relevant section if something materially changed the
overall plan.
